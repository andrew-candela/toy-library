from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Address, Item, Toy, ToyTag, User, UserItem
from app.schemas.schemas import (
    ItemCreate,
    ItemOut,
    ItemUpdate,
    ItemWithOwnerOut,
    OwnerInfo,
    PaginatedResponse,
)

router = APIRouter()


def _normalize_tag(raw: str) -> str:
    return raw.lstrip("#").strip().lower()


@router.get("", response_model=PaginatedResponse[ItemWithOwnerOut])
async def list_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    neighborhood: str | None = Query(None),
    toy_title: str | None = Query(None),
    tags: list[str] = Query(default=[]),
    my_items_only: bool = Query(False),
    toy_id: int | None = Query(None),
    owner_username: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Build a filter query that selects only Item.id to avoid cartesian products
    filter_query = select(Item.id)

    if my_items_only or neighborhood or owner_username:
        filter_query = filter_query.join(UserItem, Item.id == UserItem.item_id)
        if my_items_only:
            filter_query = filter_query.where(UserItem.user_id == current_user.id)
        if neighborhood or owner_username:
            filter_query = filter_query.join(User, UserItem.user_id == User.id)
            if neighborhood:
                filter_query = filter_query.outerjoin(
                    Address, User.id == Address.user_id
                ).where(Address.neighborhood.ilike(f"%{neighborhood}%"))
            if owner_username:
                filter_query = filter_query.where(
                    User.username.ilike(f"%{owner_username}%")
                )

    if toy_title or toy_id is not None:
        filter_query = filter_query.join(Toy, Item.toy_id == Toy.id)
        if toy_title:
            filter_query = filter_query.where(Toy.title.ilike(f"%{toy_title}%"))
        if toy_id is not None:
            filter_query = filter_query.where(Item.toy_id == toy_id)

    for tag in tags:
        normalized = _normalize_tag(tag)
        filter_query = filter_query.where(
            Item.toy_id.in_(select(ToyTag.toy_id).where(ToyTag.tag == normalized))
        )

    total = (
        await db.execute(select(func.count()).select_from(filter_query.subquery()))
    ).scalar_one()
    total_pages = max(1, (total + page_size - 1) // page_size)

    item_ids = (
        (
            await db.execute(
                filter_query.order_by(Item.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    if not item_ids:
        return PaginatedResponse(
            items=[],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    rows = (
        (
            await db.execute(
                select(Item)
                .where(Item.id.in_(item_ids))
                .options(
                    selectinload(Item.toy),
                    selectinload(Item.user_item)
                    .selectinload(UserItem.user)
                    .selectinload(User.address),
                )
                .order_by(Item.id)
            )
        )
        .scalars()
        .all()
    )

    result: list[ItemWithOwnerOut] = []
    for item in rows:
        base = ItemOut.model_validate(item).model_dump()
        owner: OwnerInfo | None = None
        if item.user_item:
            u = item.user_item.user
            item_neighborhood = u.address.neighborhood if u.address else None
            owner = OwnerInfo(username=u.username, neighborhood=item_neighborhood)
        result.append(ItemWithOwnerOut(**base, owner=owner))

    return PaginatedResponse(
        items=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        await db.execute(
            select(Item).where(Item.id == item_id).options(selectinload(Item.toy))
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("", response_model=ItemOut, status_code=201)
async def create_item(
    item_in: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    item = Item(
        toy_id=item_in.toy_id,
        condition=item_in.condition,
        date_added=now,
    )
    db.add(item)
    await db.flush()  # populate item.id before creating UserItem

    user_item = UserItem(
        user_id=current_user.id,
        item_id=item.id,
        checked_out_at=now,
    )
    db.add(user_item)
    await db.commit()
    item = (
        await db.execute(
            select(Item).where(Item.id == item.id).options(selectinload(Item.toy))
        )
    ).scalar_one()
    return item


@router.put("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: int,
    item_in: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        await db.execute(select(Item).where(Item.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in item_in.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    item = (
        await db.execute(
            select(Item).where(Item.id == item_id).options(selectinload(Item.toy))
        )
    ).scalar_one()
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        await db.execute(select(Item).where(Item.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.execute(delete(UserItem).where(UserItem.item_id == item_id))
    await db.delete(item)
    await db.commit()
