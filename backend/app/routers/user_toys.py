from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.auth import get_current_user
from app.lib.app_logging import log_activity
from app.lib.database import get_db
from app.lib.email_tools import (
    send_transfer_accepted_email,
    send_transfer_canceled_email,
    send_transfer_initiated_email,
)
from app.models.models import ToyInterest, User, UserToy, UserToySource
from app.schemas.schemas import TransferInitiateRequest, UserToyOut

router = APIRouter()


def _user_toy_options():
    return [
        selectinload(UserToy.user),
        selectinload(UserToy.pending_user),
        selectinload(UserToy.toy),
    ]


async def _open_user_toy(db: AsyncSession, toy_id: int) -> UserToy | None:
    """The row for whoever currently holds the toy.

    user_toys keeps every past holder, so the released rows have to be excluded
    or these lookups raise MultipleResultsFound the first time a toy changes
    hands.
    """
    result = await db.execute(
        select(UserToy)
        .options(*_user_toy_options())
        .where(UserToy.toy_id == toy_id, UserToy.released_at.is_(None))
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[UserToyOut])
async def list_my_toys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        (
            await db.execute(
                select(UserToy)
                .options(*_user_toy_options())
                .where(
                    UserToy.user_id == current_user.id,
                    UserToy.released_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )


@router.get("/pending-incoming", response_model=list[UserToyOut])
async def list_pending_incoming(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        (
            await db.execute(
                select(UserToy)
                .options(*_user_toy_options())
                .where(
                    UserToy.pending_user_id == current_user.id,
                    UserToy.released_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )


@router.post("/{toy_id}/transfer", response_model=UserToyOut)
async def initiate_transfer(
    toy_id: int,
    body: TransferInitiateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_toy = await _open_user_toy(db, toy_id)
    if user_toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )
    if user_toy.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this toy"
        )

    target_result = await db.execute(
        select(User).where(User.username == body.to_username)
    )
    target_user = target_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer toy to yourself",
        )

    toy_title = user_toy.toy.title
    user_toy.pending_user_id = target_user.id
    await db.commit()

    result = await db.execute(
        select(UserToy)
        .options(*_user_toy_options())
        .where(UserToy.id == user_toy.id)
        .execution_options(populate_existing=True)
    )
    user_toy = result.scalar_one()
    log_activity(
        type="ToyTransferInitiated",
        user_id=current_user.id,
        toy_id=toy_id,
        target_user_id=target_user.id,
    )
    await send_transfer_initiated_email(
        target_user.email,
        toy_title,
        current_user.username,
    )
    return user_toy


@router.post("/{toy_id}/transfer/accept", response_model=UserToyOut)
async def accept_transfer(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_toy = await _open_user_toy(db, toy_id)
    if user_toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )
    if user_toy.pending_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending transfer for this toy",
        )
    if user_toy.pending_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the pending recipient of this toy",
        )

    original_owner_email = user_toy.user.email
    toy_title = user_toy.toy.title

    interest_result = await db.execute(
        select(ToyInterest).where(
            ToyInterest.user_id == current_user.id,
            ToyInterest.toy_id == toy_id,
        )
    )
    existing_interest = interest_result.scalar_one_or_none()
    if existing_interest is not None:
        await db.delete(existing_interest)

    # Close the outgoing stint and open a new one rather than moving user_id, so
    # the handoff is retained. The partial unique index on the open row is
    # checked per statement, so the close has to reach the database before the
    # insert or the two open rows collide.
    original_user_id = user_toy.user_id
    handover_time = datetime.now(tz=timezone.utc)
    user_toy.released_at = handover_time
    user_toy.pending_user_id = None
    await db.flush()

    new_user_toy = UserToy(
        user_id=current_user.id,
        toy_id=toy_id,
        checked_out_at=handover_time,
        source=UserToySource.transferred.value,
    )
    db.add(new_user_toy)
    await db.flush()
    new_user_toy_id = new_user_toy.id
    await db.commit()
    log_activity(
        type="ToyTransferAccepted",
        user_id=current_user.id,
        toy_id=toy_id,
        original_user_id=original_user_id,
    )
    result = await db.execute(
        select(UserToy)
        .options(*_user_toy_options())
        .where(UserToy.id == new_user_toy_id)
        .execution_options(populate_existing=True)
    )
    user_toy = result.scalar_one()

    await send_transfer_accepted_email(
        original_owner_email, toy_title, current_user.username
    )
    return user_toy


@router.delete("/{toy_id}/transfer", response_model=UserToyOut)
async def cancel_transfer(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_toy = await _open_user_toy(db, toy_id)
    if user_toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )
    if user_toy.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this toy"
        )
    if user_toy.pending_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending transfer to cancel",
        )

    pending_user_email = user_toy.pending_user.email
    pending_user_id = user_toy.pending_user.id
    toy_title = user_toy.toy.title

    user_toy.pending_user_id = None
    await db.commit()
    log_activity(
        type="ToyTransferDeleted",
        user_id=current_user.id,
        toy_id=toy_id,
        pending_user_id=pending_user_id,
    )

    result = await db.execute(
        select(UserToy)
        .options(*_user_toy_options())
        .where(UserToy.id == user_toy.id)
        .execution_options(populate_existing=True)
    )
    user_toy = result.scalar_one()

    await send_transfer_canceled_email(
        pending_user_email, toy_title, current_user.username
    )
    return user_toy
