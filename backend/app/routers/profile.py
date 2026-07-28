import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.lib.auth import (
    ADMIN_USER_EMAILS,
    ALGORITHM,
    SECRET_KEY,
    add_jti_to_blocklist,
    create_access_token,
    get_current_user,
    oauth2_scheme,
)
from app.lib.database import get_db
from app.lib.email_tools import send_verification_email
from app.lib.redis import get_redis_client
from app.models.models import Address, User
from app.schemas.schemas import (
    MyProfileOut,
    ProfileOut,
    UpdateEmailRequest,
    UpdateEmailResponse,
    UpdateNeighborhoodRequest,
    UpdateNeighborhoodResponse,
    UpdateUsernameRequest,
    UpdateUsernameResponse,
)

router = APIRouter()

_VERIFY_EMAIL_TTL = 24 * 60 * 60  # 24 hours in seconds


@router.get("/me", response_model=MyProfileOut)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    address = (
        await db.execute(select(Address).where(Address.user_id == current_user.id))
    ).scalar_one_or_none()
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_email_verified": current_user.is_email_verified,
        "neighborhood": address.neighborhood if address else None,
        "is_admin": current_user.email.lower() in ADMIN_USER_EMAILS,
    }


@router.patch("/username", response_model=UpdateUsernameResponse)
async def update_username(
    body: UpdateUsernameRequest,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.username == current_user.username:
        new_token = create_access_token(subject=current_user.username)
        return {
            "user": current_user,
            "access_token": new_token,
            "token_type": "bearer",
        }

    existing = (
        await db.execute(select(User).where(User.username == body.username))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    # Blacklist the current token before issuing a new one.
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    jti: str = payload["jti"]
    exp: int = payload["exp"]
    ttl = max(exp - int(datetime.now(timezone.utc).timestamp()), 0)
    await add_jti_to_blocklist(jti, ttl)

    current_user.username = body.username
    await db.commit()
    await db.refresh(current_user)

    new_token = create_access_token(subject=current_user.username)
    return {
        "user": current_user,
        "access_token": new_token,
        "token_type": "bearer",
    }


@router.patch("/email", response_model=UpdateEmailResponse)
async def update_email(
    body: UpdateEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    new_email = str(body.email)

    if new_email == current_user.email:
        return {"message": "Email address unchanged."}

    existing = (
        await db.execute(select(User).where(User.email == new_email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already in use",
        )

    current_user.email = new_email
    current_user.is_email_verified = False
    await db.commit()

    # Invalidate any existing verification token, then issue a fresh one.
    redis = get_redis_client()
    old_token: str | None = await redis.get(f"verify_email_user:{current_user.id}")
    if old_token:
        await redis.delete(f"verify_email:{old_token}")
    token = str(uuid.uuid4())
    await redis.setex(f"verify_email:{token}", _VERIFY_EMAIL_TTL, str(current_user.id))
    await redis.setex(f"verify_email_user:{current_user.id}", _VERIFY_EMAIL_TTL, token)
    background_tasks.add_task(send_verification_email, current_user.email, token)

    return {
        "message": f"Verification email sent to {new_email}. Please verify your new address before your next login."
    }


@router.patch("/neighborhood", response_model=UpdateNeighborhoodResponse)
async def update_neighborhood(
    body: UpdateNeighborhoodRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    address = (
        await db.execute(select(Address).where(Address.user_id == current_user.id))
    ).scalar_one_or_none()
    if address is None:
        address = Address(user_id=current_user.id, neighborhood=body.neighborhood)
        db.add(address)
    else:
        address.neighborhood = body.neighborhood
    await db.commit()
    return {"neighborhood": address.neighborhood}


@router.get("/{username}", response_model=ProfileOut)
async def get_user_profile(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = (
        (
            await db.execute(
                select(User)
                .options(joinedload(User.address))
                .where(User.username == username)
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_email_verified": user.is_email_verified,
        "neighborhood": user.address.neighborhood if user.address else None,
    }
