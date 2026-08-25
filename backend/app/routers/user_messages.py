import time

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.app_logging import log_activity
from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.lib.email_tools import send_user_contact_email
from app.lib.redis import get_redis_client
from app.models.models import ToyInterest, User, UserToy
from app.schemas.schemas import UserContactEmailRequest, UserContactEmailResponse

router = APIRouter()

_CONTACT_WINDOW_SECONDS = 60 * 60
_MAX_CONTACT_EMAILS_PER_WINDOW = 5


async def _check_contact_rate_limit(redis_client: Redis, sender_id: int) -> None:
    key = f"contact_email_rate_limit:{sender_id}"
    now = time.time()

    async with redis_client.pipeline(transaction=True) as pipe:
        pipe.zremrangebyscore(key, 0, now - _CONTACT_WINDOW_SECONDS)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, _CONTACT_WINDOW_SECONDS)
        _, _, request_count, _ = await pipe.execute()

    if request_count > _MAX_CONTACT_EMAILS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit for emails reached. Please wait before sending another message.",
        )


async def _users_have_transfer_or_interest_relationship(
    db: AsyncSession,
    sender_id: int,
    recipient_id: int,
) -> bool:
    # Every check below is scoped to open rows: a relationship that ended when
    # the toy changed hands must not keep granting contact permission.
    transfer_exists = (
        await db.execute(
            select(UserToy.id)
            .where(
                and_(
                    UserToy.user_id == sender_id,
                    UserToy.pending_user_id == recipient_id,
                    UserToy.released_at.is_(None),
                )
            )
            .limit(1)
        )
    ).scalar_one_or_none() is not None
    if transfer_exists:
        return True

    reverse_transfer_exists = (
        await db.execute(
            select(UserToy.id)
            .where(
                and_(
                    UserToy.user_id == recipient_id,
                    UserToy.pending_user_id == sender_id,
                    UserToy.released_at.is_(None),
                )
            )
            .limit(1)
        )
    ).scalar_one_or_none() is not None
    if reverse_transfer_exists:
        return True

    sender_owns_recipient_interest = (
        await db.execute(
            select(UserToy.id)
            .join(ToyInterest, ToyInterest.toy_id == UserToy.toy_id)
            .where(
                and_(
                    UserToy.user_id == sender_id,
                    ToyInterest.user_id == recipient_id,
                    UserToy.released_at.is_(None),
                )
            )
            .limit(1)
        )
    ).scalar_one_or_none() is not None
    if sender_owns_recipient_interest:
        return True

    recipient_owns_sender_interest = (
        await db.execute(
            select(UserToy.id)
            .join(ToyInterest, ToyInterest.toy_id == UserToy.toy_id)
            .where(
                and_(
                    UserToy.user_id == recipient_id,
                    ToyInterest.user_id == sender_id,
                    UserToy.released_at.is_(None),
                )
            )
            .limit(1)
        )
    ).scalar_one_or_none() is not None

    return recipient_owns_sender_interest


@router.post("/send", response_model=UserContactEmailResponse)
async def send_user_message(
    body: UserContactEmailRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis_client),
    current_user: User = Depends(get_current_user),
):
    recipient = (
        await db.execute(select(User).where(User.username == body.to_username))
    ).scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send email to yourself",
        )

    if not recipient.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient is not available for contact",
        )

    has_relationship = await _users_have_transfer_or_interest_relationship(
        db, current_user.id, recipient.id
    )
    if not has_relationship:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only contact users connected through transfer or interest activity",
        )

    await _check_contact_rate_limit(redis_client, current_user.id)

    await send_user_contact_email(
        to_email=recipient.email,
        to_username=recipient.username,
        from_username=current_user.username,
        message=body.message,
    )
    log_activity(
        type="UserSentMessage", user_id=current_user.id, target_user=recipient.id
    )
    return UserContactEmailResponse(message="Email sent")
