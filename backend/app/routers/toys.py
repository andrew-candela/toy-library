from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.lib.toy_images import delete_toy_image, save_toy_image
from app.models.models import Toy, ToyCondition, ToyInterest, ToyTag, User, UserToy
from app.schemas.schemas import PaginatedResponse, ToyOut

router = APIRouter()


def _normalize_tag(raw: str) -> str:
    return raw.lstrip("#").strip().lower()


@router.get("/", response_model=PaginatedResponse[ToyOut])
async def list_toys(
    tags: list[str] = Query(default=[]),
    owned_by_current_user: bool = Query(False),
    owner_username: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Toy)
    if owned_by_current_user:
        query = query.where(
            Toy.id.in_(select(UserToy.toy_id).where(UserToy.user_id == current_user.id))
        )
    if owner_username:
        query = query.where(
            Toy.id.in_(
                select(UserToy.toy_id)
                .join(User, UserToy.user_id == User.id)
                .where(User.username == owner_username)
            )
        )
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
    title: str = Form(...),
    description: str | None = Form(None),
    age_range: str | None = Form(None),
    condition: ToyCondition | None = Form(None),
    date_added: datetime | None = Form(None),
    tags: list[str] = Form(default=[]),
    image_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    image_path = await save_toy_image(image_file) if image_file is not None else None
    toy = Toy(
        title=title,
        description=description,
        age_range=age_range,
        image_path=image_path,
        condition=condition,
        date_added=date_added,
    )
    db.add(toy)
    await db.flush()
    user_toy = UserToy(
        user_id=current_user.id,
        toy_id=toy.id,
        checked_out_at=datetime.now(tz=timezone.utc),
    )
    db.add(user_toy)
    for raw_tag in tags:
        normalized = _normalize_tag(raw_tag)
        if normalized:
            db.add(ToyTag(toy_id=toy.id, tag=normalized))
    await db.commit()
    return (await db.execute(select(Toy).where(Toy.id == toy.id))).scalar_one()


@router.put("/{toy_id}", response_model=ToyOut)
async def update_toy(
    toy_id: int,
    title: str | None = Form(None),
    description: str | None = Form(None),
    age_range: str | None = Form(None),
    condition: ToyCondition | None = Form(None),
    date_added: datetime | None = Form(None),
    tags: list[str] = Form(default=[]),
    remove_image: bool = Form(False),
    image_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    toy = (await db.execute(select(Toy).where(Toy.id == toy_id))).scalar_one_or_none()
    if not toy:
        raise HTTPException(status_code=404, detail="Toy not found")
    old_image_path = toy.image_path
    new_image_path: str | None = None

    try:
        if title is not None:
            toy.title = title
        if description is not None:
            toy.description = description
        if age_range is not None:
            toy.age_range = age_range
        if condition is not None:
            toy.condition = condition
        if date_added is not None:
            toy.date_added = date_added

        if image_file is not None:
            new_image_path = await save_toy_image(image_file)
            toy.image_path = new_image_path
        elif remove_image:
            toy.image_path = None

        await db.execute(delete(ToyTag).where(ToyTag.toy_id == toy.id))
        for raw_tag in tags:
            normalized = _normalize_tag(raw_tag)
            if normalized:
                db.add(ToyTag(toy_id=toy.id, tag=normalized))

        await db.commit()
    except Exception:
        if new_image_path is not None:
            delete_toy_image(new_image_path)
        raise

    if old_image_path and old_image_path != toy.image_path:
        delete_toy_image(old_image_path)

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
    user_toy = (
        await db.execute(select(UserToy).where(UserToy.toy_id == toy_id))
    ).scalar_one_or_none()
    if not user_toy:
        raise HTTPException(
            status_code=409,
            detail="This toy cannot be deleted because its ownership record is missing.",
        )

    if user_toy.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this toy")

    if user_toy.pending_user_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Cancel the pending transfer before deleting this toy.",
        )

    delete_toy_image(toy.image_path)
    await db.execute(delete(ToyInterest).where(ToyInterest.toy_id == toy_id))
    await db.delete(user_toy)
    await db.delete(toy)
    await db.commit()
