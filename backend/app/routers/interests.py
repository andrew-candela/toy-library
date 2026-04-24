from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Item, ItemInterest, User
from app.schemas.schemas import InterestOut

router = APIRouter()


@router.get("/interests", response_model=list[InterestOut])
async def list_all_interests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ItemInterest).options(selectinload(ItemInterest.user))
    )
    return result.scalars().all()


@router.get("/{item_id}/interests", response_model=list[InterestOut])
async def list_interests(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await db.get(Item, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    result = await db.execute(
        select(ItemInterest)
        .options(selectinload(ItemInterest.user))
        .where(ItemInterest.item_id == item_id)
    )
    return result.scalars().all()


@router.post(
    "/{item_id}/interests",
    response_model=InterestOut,
    status_code=status.HTTP_201_CREATED,
)
async def express_interest(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await db.get(Item, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )

    existing = await db.execute(
        select(ItemInterest).where(
            ItemInterest.user_id == current_user.id,
            ItemInterest.item_id == item_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already expressed interest in this item",
        )

    interest = ItemInterest(
        user_id=current_user.id,
        item_id=item_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(interest)
    await db.flush()

    result = await db.execute(
        select(ItemInterest)
        .options(selectinload(ItemInterest.user))
        .where(ItemInterest.id == interest.id)
    )
    interest = result.scalar_one()
    await db.commit()
    return interest


@router.delete("/{item_id}/interests", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interest(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ItemInterest).where(
            ItemInterest.user_id == current_user.id,
            ItemInterest.item_id == item_id,
        )
    )
    interest = result.scalar_one_or_none()
    if interest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No interest found for this item",
        )
    await db.delete(interest)
    await db.commit()
