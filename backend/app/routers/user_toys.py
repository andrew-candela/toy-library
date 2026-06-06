from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.lib.email import (
    send_transfer_accepted_email,
    send_transfer_canceled_email,
    send_transfer_initiated_email,
)
from app.models.models import ToyInterest, User, UserToy
from app.schemas.schemas import TransferInitiateRequest, UserToyOut

router = APIRouter()


def _user_toy_options():
    return [
        selectinload(UserToy.user),
        selectinload(UserToy.pending_user),
        selectinload(UserToy.toy),
    ]


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
                .where(UserToy.user_id == current_user.id)
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
                .where(UserToy.pending_user_id == current_user.id)
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
    result = await db.execute(
        select(UserToy).options(*_user_toy_options()).where(UserToy.toy_id == toy_id)
    )
    user_toy = result.scalar_one_or_none()
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
        select(UserToy).options(*_user_toy_options()).where(UserToy.id == user_toy.id)
    )
    user_toy = result.scalar_one()

    await send_transfer_initiated_email(
        target_user.email, toy_title, current_user.username
    )
    return user_toy


@router.post("/{toy_id}/transfer/accept", response_model=UserToyOut)
async def accept_transfer(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserToy).options(*_user_toy_options()).where(UserToy.toy_id == toy_id)
    )
    user_toy = result.scalar_one_or_none()
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

    user_toy.user_id = current_user.id
    user_toy.pending_user_id = None
    await db.commit()

    result = await db.execute(
        select(UserToy).options(*_user_toy_options()).where(UserToy.id == user_toy.id)
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
    result = await db.execute(
        select(UserToy).options(*_user_toy_options()).where(UserToy.toy_id == toy_id)
    )
    user_toy = result.scalar_one_or_none()
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
    toy_title = user_toy.toy.title

    user_toy.pending_user_id = None
    await db.commit()

    result = await db.execute(
        select(UserToy).options(*_user_toy_options()).where(UserToy.id == user_toy.id)
    )
    user_toy = result.scalar_one()

    await send_transfer_canceled_email(
        pending_user_email, toy_title, current_user.username
    )
    return user_toy
