from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Toy, ToyInterest, User
from app.schemas.schemas import InterestOut

router = APIRouter()


@router.get("", response_model=list[InterestOut])
async def list_all_interests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ToyInterest).options(selectinload(ToyInterest.user))
    )
    return result.scalars().all()


@router.get("/{toy_id}", response_model=list[InterestOut])
async def list_interests(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = await db.get(Toy, toy_id)
    if toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )
    result = await db.execute(
        select(ToyInterest)
        .options(selectinload(ToyInterest.user))
        .where(ToyInterest.toy_id == toy_id)
    )
    return result.scalars().all()


@router.post(
    "/{toy_id}",
    response_model=InterestOut,
    status_code=status.HTTP_201_CREATED,
)
async def express_interest(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = await db.get(Toy, toy_id)
    if toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )

    existing = await db.execute(
        select(ToyInterest).where(
            ToyInterest.user_id == current_user.id,
            ToyInterest.toy_id == toy_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already expressed interest in this toy",
        )

    interest = ToyInterest(
        user_id=current_user.id,
        toy_id=toy_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(interest)
    await db.flush()

    result = await db.execute(
        select(ToyInterest)
        .options(selectinload(ToyInterest.user))
        .where(ToyInterest.id == interest.id)
    )
    interest = result.scalar_one()
    await db.commit()
    return interest


@router.delete("/{toy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interest(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ToyInterest).where(
            ToyInterest.user_id == current_user.id,
            ToyInterest.toy_id == toy_id,
        )
    )
    interest = result.scalar_one_or_none()
    if interest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No interest found for this toy",
        )
    await db.delete(interest)
    await db.commit()
