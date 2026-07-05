import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import (
    SECRET_KEY,
    ALGORITHM,
    add_jti_to_blocklist,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
    oauth2_scheme,
    password_form_type,
)
from app.lib.database import get_db
from app.lib.email_tools import (
    send_password_reset_email,
    send_verification_email,
)
from app.lib.redis import get_redis_client
from app.lib.dependencies import rate_limit_request
from app.models.models import Address, User, AllowList
from app.schemas.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    Token,
    UserCreate,
    UserOut,
    VerifyEmailResponse,
    ResendVerificationRequest,
)

router = APIRouter(dependencies=[Depends(rate_limit_request)])


_VERIFY_EMAIL_TTL = 24 * 60 * 60  # 24 hours in seconds
_RESET_PASSWORD_TTL = 60 * 60  # 1 hour in seconds


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> User:
    if not (
        await db.execute(select(AllowList).where(AllowList.email == body.email))
    ).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email has not been invited. Please contact the administrators.",
        )
    if (
        await db.execute(select(User).where(User.username == body.username))
    ).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    if (
        await db.execute(select(User).where(User.email == body.email))
    ).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    address = Address(user_id=user.id, neighborhood=None)
    db.add(address)
    await db.commit()
    token = str(uuid.uuid4())
    redis = get_redis_client()
    await redis.setex(f"verify_email:{token}", _VERIFY_EMAIL_TTL, str(user.id))
    await redis.setex(f"verify_email_user:{user.id}", _VERIFY_EMAIL_TTL, token)
    background_tasks.add_task(send_verification_email, user.email, token)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: password_form_type, db: AsyncSession = Depends(get_db)
) -> dict:
    user = (
        await db.execute(select(User).where(User.username == form_data.username))
    ).scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )
    access_token = create_access_token(subject=user.username)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    token: str = Query(...), db: AsyncSession = Depends(get_db)
) -> dict:
    redis = get_redis_client()
    user_id_str: str | None = await redis.get(f"verify_email:{token}")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )
    user = await db.get(User, int(user_id_str))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )
    user.is_email_verified = True
    await db.commit()
    await redis.delete(f"verify_email:{token}", f"verify_email_user:{user.id}")
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification", response_model=VerifyEmailResponse)
async def resend_verification(
    body: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Always return the same response to avoid leaking whether an email is registered.
    generic = {
        "message": "If that email is registered and unverified, a new link has been sent."
    }
    user = (
        await db.execute(select(User).where(User.email == body.email))
    ).scalar_one_or_none()
    if not user or user.is_email_verified:
        return generic
    redis = get_redis_client()
    # Invalidate any existing token for this user before issuing a new one.
    old_token: str | None = await redis.get(f"verify_email_user:{user.id}")
    if old_token:
        await redis.delete(f"verify_email:{old_token}")
    token = str(uuid.uuid4())
    await redis.setex(f"verify_email:{token}", _VERIFY_EMAIL_TTL, str(user.id))
    await redis.setex(f"verify_email_user:{user.id}", _VERIFY_EMAIL_TTL, token)
    background_tasks.add_task(send_verification_email, user.email, token)
    return generic


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Always return the same response to avoid leaking whether an email is registered.
    generic = {
        "message": "If that email is registered, a password reset link has been sent."
    }
    user = (
        await db.execute(select(User).where(User.email == body.email))
    ).scalar_one_or_none()
    if not user:
        return generic
    redis = get_redis_client()
    # Invalidate any existing reset token before issuing a new one.
    old_token: str | None = await redis.get(f"reset_password_user:{user.id}")
    if old_token:
        await redis.delete(f"reset_password:{old_token}")
    token = secrets.token_urlsafe(32)
    await redis.setex(f"reset_password:{token}", _RESET_PASSWORD_TTL, str(user.id))
    await redis.setex(f"reset_password_user:{user.id}", _RESET_PASSWORD_TTL, token)
    background_tasks.add_task(
        send_password_reset_email, user.email, token, user.username
    )
    return generic


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    redis = get_redis_client()
    user_id_str: str | None = await redis.get(f"reset_password:{body.token}")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    user = await db.get(User, int(user_id_str))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    await redis.delete(f"reset_password:{body.token}", f"reset_password_user:{user.id}")
    return {"message": "Password reset successfully. You can now sign in."}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti: str | None = payload.get("jti")
        exp: int | None = payload.get("exp")
        if jti and exp:
            ttl = int(exp - datetime.now(timezone.utc).timestamp())
            await add_jti_to_blocklist(jti, ttl)
    except JWTError:
        pass  # token already invalid; logout is idempotent
    return {"message": "Logged out"}
