from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.app_logging import log_activity
from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Toy, ToyInterest, User, UserToy
from app.schemas.schemas import (
    InterestDetailOut,
    InterestOut,
    InterestSummaryOut,
    InterestUserOut,
)

router = APIRouter()


async def _live_toy(db: AsyncSession, toy_id: int) -> Toy | None:
    """The toy, unless it has been delisted.

    A `db.get(Toy, toy_id)` here would look harmless and be wrong: a primary-key
    get goes straight to the identity map or a bare SELECT, so it hands back
    soft-deleted rows that every other read path filters out.
    """
    result = await db.execute(
        select(Toy).where(Toy.id == toy_id, Toy.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[InterestSummaryOut])
async def list_all_interests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    counts_result = await db.execute(
        select(ToyInterest.toy_id, func.count(ToyInterest.id))
        .group_by(ToyInterest.toy_id)
        .order_by(ToyInterest.toy_id)
    )
    interested_result = await db.execute(
        select(ToyInterest.toy_id).where(ToyInterest.user_id == current_user.id)
    )

    viewer_interested_toy_ids = set(interested_result.scalars().all())

    return [
        InterestSummaryOut(
            toy_id=toy_id,
            interested_count=count,
            viewer_interested=toy_id in viewer_interested_toy_ids,
        )
        for toy_id, count in counts_result.all()
    ]


@router.get("/{toy_id}", response_model=InterestDetailOut)
async def list_interests(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = await _live_toy(db, toy_id)
    if toy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Toy not found"
        )

    count_result = await db.execute(
        select(func.count(ToyInterest.id)).where(ToyInterest.toy_id == toy_id)
    )
    interested_count = count_result.scalar_one()

    owner_result = await db.execute(
        # Only the toy's current holder may see who is interested — giving a toy
        # away ends that.
        select(UserToy.id).where(
            UserToy.toy_id == toy_id,
            UserToy.user_id == current_user.id,
            UserToy.released_at.is_(None),
        )
    )
    can_view_usernames = owner_result.scalar_one_or_none() is not None

    interested_usernames: list[InterestUserOut] = []
    if can_view_usernames:
        users_result = await db.execute(
            select(User.username, ToyInterest.created_at)
            .join(ToyInterest, ToyInterest.user_id == User.id)
            .where(ToyInterest.toy_id == toy_id)
            .order_by(ToyInterest.created_at.desc(), User.username.asc())
        )
        interested_usernames = [
            InterestUserOut(username=username, created_at=created_at)
            for username, created_at in users_result.all()
        ]

    return InterestDetailOut(
        toy_id=toy_id,
        interested_count=interested_count,
        can_view_usernames=can_view_usernames,
        interested_usernames=interested_usernames,
    )


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
    toy = await _live_toy(db, toy_id)
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
        created_at=datetime.now(UTC),
    )
    db.add(interest)
    # Denormalized onto the toy because this row may not survive: interests are
    # hard-deleted below, and a `max(created_at)` over what is left would forget
    # that anyone had ever asked.
    toy.last_interest_at = interest.created_at
    await db.flush()

    result = await db.execute(
        select(ToyInterest)
        .options(selectinload(ToyInterest.user))
        .where(ToyInterest.id == interest.id)
    )
    interest = result.scalar_one()
    await db.commit()
    log_activity(
        type="InterestExpressed",
        user_id=current_user.id,
        toy_id=toy_id,
    )
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
    # `toys.last_interest_at` is deliberately left alone. Interest really was
    # shown at that moment, and withdrawing it does not retroactively unshow it
    # — recomputing or clearing the column here would hand the staleness clock
    # back the lossiness it exists to avoid.
    await db.delete(interest)
    await db.commit()
    log_activity(
        type="InterestRemoved",
        user_id=current_user.id,
        toy_id=toy_id,
    )
