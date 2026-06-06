from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Toy, ToyInterest, ToyTag, User, UserToy
from app.schemas.schemas import PaginatedResponse, ToyCreate, ToyOut, ToyUpdate

router = APIRouter()


def _normalize_tag(raw: str) -> str:
    return raw.lstrip("#").strip().lower()


@router.get("/", response_model=PaginatedResponse[ToyOut])
async def list_toys(
    tags: list[str] = Query(default=[]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Toy)
    for tag in tags:
        normalized = _normalize_tag(tag)
        query = query.where(
            Toy.id.in_(select(ToyTag.toy_id).where(ToyTag.tag == normalized))
        )
    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()
    total_pages = max(1, (total + page_size - 1) // page_size)
    rows = (
        (
            await db.execute(
                query.order_by(Toy.id).offset((page - 1) * page_size).limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return PaginatedResponse(
        items=list(rows),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/tags", response_model=list[str])
async def suggest_tags(
    q: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefix = _normalize_tag(q)
    if not prefix:
        return []
    result = await db.execute(
        select(ToyTag.tag)
        .where(ToyTag.tag.like(f"{prefix}%"))
        .distinct()
        .order_by(ToyTag.tag)
        .limit(5)
    )
    return result.scalars().all()


@router.get("/{toy_id}", response_model=ToyOut)
async def get_toy(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = (await db.execute(select(Toy).where(Toy.id == toy_id))).scalar_one_or_none()
    if not toy:
        raise HTTPException(status_code=404, detail="Toy not found")
    return toy


@router.post("", response_model=ToyOut, status_code=201)
async def create_toy(
    toy_in: ToyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = Toy(
        title=toy_in.title,
        description=toy_in.description,
        age_range=toy_in.age_range,
        image_url=toy_in.image_url,
        condition=toy_in.condition,
        date_added=toy_in.date_added,
    )
    db.add(toy)
    await db.flush()
    user_toy = UserToy(
        user_id=current_user.id,
        toy_id=toy.id,
        checked_out_at=datetime.now(tz=timezone.utc),
    )
    db.add(user_toy)
    for raw_tag in toy_in.tags:
        normalized = _normalize_tag(raw_tag)
        if normalized:
            db.add(ToyTag(toy_id=toy.id, tag=normalized))
    await db.commit()
    return (await db.execute(select(Toy).where(Toy.id == toy.id))).scalar_one()


@router.put("/{toy_id}", response_model=ToyOut)
async def update_toy(
    toy_id: int,
    toy_in: ToyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = (await db.execute(select(Toy).where(Toy.id == toy_id))).scalar_one_or_none()
    if not toy:
        raise HTTPException(status_code=404, detail="Toy not found")
    update_data = toy_in.model_dump(exclude_unset=True)
    tags = update_data.pop("tags", None)
    for key, value in update_data.items():
        setattr(toy, key, value)
    if tags is not None:
        await db.execute(delete(ToyTag).where(ToyTag.toy_id == toy.id))
        for raw_tag in tags:
            normalized = _normalize_tag(raw_tag)
            if normalized:
                db.add(ToyTag(toy_id=toy.id, tag=normalized))
    await db.commit()
    return (await db.execute(select(Toy).where(Toy.id == toy_id))).scalar_one()


@router.delete("/{toy_id}", status_code=204)
async def delete_toy(
    toy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = (await db.execute(select(Toy).where(Toy.id == toy_id))).scalar_one_or_none()
    if not toy:
        raise HTTPException(status_code=404, detail="Toy not found")
    user_toy_count = (
        await db.execute(
            select(func.count()).select_from(UserToy).where(UserToy.toy_id == toy_id)
        )
    ).scalar_one()
    toy_interest_count = (
        await db.execute(
            select(func.count())
            .select_from(ToyInterest)
            .where(ToyInterest.toy_id == toy_id)
        )
    ).scalar_one()
    if user_toy_count > 0 or toy_interest_count > 0:
        raise HTTPException(
            status_code=409,
            detail="This toy cannot be deleted while it is checked out or has pending interests.",
        )
    await db.delete(toy)
    await db.commit()
