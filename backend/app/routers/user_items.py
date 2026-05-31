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
from app.models.models import Item, ItemInterest, User, UserItem
from app.schemas.schemas import TransferInitiateRequest, UserItemOut

router = APIRouter()


def _user_item_options():
    return [
        selectinload(UserItem.user),
        selectinload(UserItem.pending_user),
        selectinload(UserItem.item).selectinload(Item.toy),
    ]


@router.get("", response_model=list[UserItemOut])
async def list_my_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        (
            await db.execute(
                select(UserItem)
                .options(*_user_item_options())
                .where(UserItem.user_id == current_user.id)
            )
        )
        .scalars()
        .all()
    )


@router.get("/pending-incoming", response_model=list[UserItemOut])
async def list_pending_incoming(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        (
            await db.execute(
                select(UserItem)
                .options(*_user_item_options())
                .where(UserItem.pending_user_id == current_user.id)
            )
        )
        .scalars()
        .all()
    )


@router.post("/{item_id}/transfer", response_model=UserItemOut)
async def initiate_transfer(
    item_id: int,
    body: TransferInitiateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.item_id == item_id)
    )
    user_item = result.scalar_one_or_none()
    if user_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    if user_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this item"
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
            detail="Cannot transfer item to yourself",
        )

    item_title = user_item.item.toy.title
    user_item.pending_user_id = target_user.id
    await db.commit()

    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.id == user_item.id)
    )
    user_item = result.scalar_one()

    await send_transfer_initiated_email(
        target_user.email, item_title, current_user.username
    )
    return user_item


@router.post("/{item_id}/transfer/accept", response_model=UserItemOut)
async def accept_transfer(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.item_id == item_id)
    )
    user_item = result.scalar_one_or_none()
    if user_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    if user_item.pending_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending transfer for this item",
        )
    if user_item.pending_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the pending recipient of this item",
        )

    original_owner_email = user_item.user.email
    item_title = user_item.item.toy.title

    interest_result = await db.execute(
        select(ItemInterest).where(
            ItemInterest.user_id == current_user.id,
            ItemInterest.item_id == item_id,
        )
    )
    existing_interest = interest_result.scalar_one_or_none()
    if existing_interest is not None:
        await db.delete(existing_interest)

    user_item.user_id = current_user.id
    user_item.pending_user_id = None
    await db.commit()

    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.id == user_item.id)
    )
    user_item = result.scalar_one()

    await send_transfer_accepted_email(
        original_owner_email, item_title, current_user.username
    )
    return user_item


@router.delete("/{item_id}/transfer", response_model=UserItemOut)
async def cancel_transfer(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.item_id == item_id)
    )
    user_item = result.scalar_one_or_none()
    if user_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    if user_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this item"
        )
    if user_item.pending_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending transfer to cancel",
        )

    pending_user_email = user_item.pending_user.email
    item_title = user_item.item.toy.title

    user_item.pending_user_id = None
    await db.commit()

    result = await db.execute(
        select(UserItem)
        .options(*_user_item_options())
        .where(UserItem.id == user_item.id)
    )
    user_item = result.scalar_one()

    await send_transfer_canceled_email(
        pending_user_email, item_title, current_user.username
    )
    return user_item
