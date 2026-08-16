from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    BackgroundTasks,
)
import structlog
from typing import Sequence
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import get_current_user, get_admin_user
from app.lib.app_logging import log_activity
from app.lib.database import get_db
from app.lib.toy_images import (
    delete_toy_image,
    save_toy_image,
    toy_embedding,
    embed_description,
)
from app.models.models import (
    Address,
    Toy,
    ToyCondition,
    ToyInterest,
    ToyTag,
    User,
    UserToy,
)
from app.schemas.schemas import PaginatedResponse, ToyOut

logger = structlog.getLogger(__name__)
router = APIRouter()


def _normalize_tag(raw: str) -> str:
    return raw.lstrip("#").strip().lower()


def _validate_age_range(min_age: int | None, max_age: int | None) -> None:
    if min_age is not None and min_age < 0:
        raise HTTPException(status_code=400, detail="Minimum age must be 0 or greater")
    if max_age is not None and max_age < 0:
        raise HTTPException(status_code=400, detail="Maximum age must be 0 or greater")
    if min_age is not None and max_age is not None and min_age > max_age:
        raise HTTPException(
            status_code=400,
            detail="Minimum age must be less than or equal to maximum age",
        )


@router.get("/", response_model=PaginatedResponse[ToyOut])
async def list_toys(
    tags: list[str] = Query(default=[]),
    owned_by_current_user: bool = Query(False),
    owner_username: str | None = Query(None),
    neighborhood: str | None = Query(None),
    age: int | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if age is not None and age < 0:
        raise HTTPException(status_code=400, detail="Age must be 0 or greater")
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
    if neighborhood:
        query = query.where(
            Toy.id.in_(
                select(UserToy.toy_id)
                .join(User, UserToy.user_id == User.id)
                .join(Address, Address.user_id == User.id)
                .where(Address.neighborhood == neighborhood)
            )
        )
    if age is not None:
        query = query.where(
            Toy.min_age.is_not(None),
            Toy.max_age.is_not(None),
            Toy.min_age <= age,
            Toy.max_age >= age,
        )
    for tag in tags:
        normalized = _normalize_tag(tag)
        query = query.where(
            Toy.id.in_(select(ToyTag.toy_id).where(ToyTag.tag == normalized))
        )

    trimmed_search = search.strip() if search else None
    if trimmed_search:
        # PATH 1: SEMANTIC SEARCH (Apply Band + Cliff)
        query_vector = await embed_description(trimmed_search)

        # Ask for both the Toy model and the calculated distance
        distance_col = Toy.embedding.cosine_distance(query_vector).label("distance")
        search_query = query.add_columns(distance_col).order_by(distance_col).limit(100)

        # .all() returns a list of tuples: (Toy, float)
        candidates = (await db.execute(search_query)).all()

        filtered_toys = []
        if candidates:
            # For distance, lower is better. best_dist is the smallest distance.
            best_dist = candidates[0].distance

            # Thresholds to tune for your specific embeddings
            MAX_ABSOLUTE_DIST = 0.50  # Safety floor (ignore items further than this)
            MAX_RELATIVE_MARGIN = (
                0.15  # Band: ignore items this much further than the top match
            )
            CLIFF_GAP_THRESHOLD = (
                0.05  # Cliff: cutoff if gap between adjacent items exceeds this
            )

            for i, row in enumerate(candidates):
                toy_obj, current_dist = row

                # 1. Absolute floor cutoff
                if current_dist > MAX_ABSOLUTE_DIST:
                    break

                # 2. Relative band cutoff
                if current_dist > best_dist + MAX_RELATIVE_MARGIN:
                    break

                # 3. Cliff detection
                if i > 0:
                    prev_dist = candidates[i - 1].distance
                    gap = current_dist - prev_dist
                    if gap >= CLIFF_GAP_THRESHOLD:
                        break

                filtered_toys.append(toy_obj)

        # In-memory pagination for the filtered results
        total = len(filtered_toys)
        total_pages = max(1, (total + page_size - 1) // page_size)

        start_idx = (page - 1) * page_size
        rows = filtered_toys[start_idx : start_idx + page_size]

    else:
        # PATH 2: STANDARD RELATIONAL FILTERS (SQL Pagination)
        total = (
            await db.execute(select(func.count()).select_from(query.subquery()))
        ).scalar_one()
        total_pages = max(1, (total + page_size - 1) // page_size)

        rows = (
            (
                await db.execute(
                    query.order_by(Toy.id)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            )
            .scalars()
            .all()
        )

    toy_ids = [toy.id for toy in rows]
    neighborhood_by_toy_id: dict[int, str | None] = {}
    if toy_ids:
        neighborhood_rows = (
            await db.execute(
                select(UserToy.toy_id, Address.neighborhood)
                .join(User, UserToy.user_id == User.id)
                .join(Address, Address.user_id == User.id)
                .where(UserToy.toy_id.in_(toy_ids))
            )
        ).all()
        neighborhood_by_toy_id = {
            row.toy_id: row.neighborhood for row in neighborhood_rows
        }

    items = []
    for toy in rows:
        toy_out = ToyOut.model_validate(toy)
        toy_out.neighborhood = neighborhood_by_toy_id.get(toy.id)
        items.append(toy_out)

    return PaginatedResponse(
        items=items,
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

    owner_username = (
        await db.execute(
            select(User.username)
            .join(UserToy, UserToy.user_id == User.id)
            .where(UserToy.toy_id == toy_id)
        )
    ).scalar_one_or_none()

    toy_out = ToyOut.model_validate(toy)
    toy_out.owner_username = owner_username
    return toy_out


@router.post("/semantic_search", response_model=Sequence[ToyOut])
async def semantic_toy_search_debug(
    description: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # max_distance = 0.8
    query_vector = await embed_description(description)
    distance = Toy.embedding.cosine_distance(query_vector)
    result = await db.execute(
        select(Toy, distance.label("score"))
        # .where(distance < max_distance)
        .order_by(distance)
    )
    rows = result.all()
    matched_toys = []

    logger.warning(f"--- Search Results for: '{description}' ---")
    if not rows:
        logger.warning("No results found below the threshold.")

    for toy, score in rows:
        # Format the score to 4 decimal places for readability
        logger.warning(f"Distance: {score:.4f} | Toy ID: {toy.id} | Name: {toy.title}")
        matched_toys.append(toy)

    logger.warning("---------------------------------------------")

    # 5. Return only the toys so your FastAPI response remains unchanged
    return matched_toys
    return result.scalars().all()


@router.post("", response_model=ToyOut, status_code=201)
async def create_toy(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: str | None = Form(None),
    min_age: int | None = Form(None),
    max_age: int | None = Form(None),
    condition: ToyCondition | None = Form(None),
    date_added: datetime | None = Form(None),
    tags: list[str] = Form(default=[]),
    image_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_age_range(min_age, max_age)
    image_path = await save_toy_image(image_file) if image_file is not None else None
    toy = Toy(
        title=title,
        description=description,
        min_age=min_age,
        max_age=max_age,
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
    log_activity(type="ToyCreated", user_id=current_user.id, toy_id=toy.id)
    background_tasks.add_task(toy_embedding, toy.id)
    return (await db.execute(select(Toy).where(Toy.id == toy.id))).scalar_one()


@router.put("/{toy_id}", response_model=ToyOut)
async def update_toy(
    toy_id: int,
    background_tasks: BackgroundTasks,
    title: str | None = Form(None),
    description: str | None = Form(None),
    min_age: int | None = Form(None),
    max_age: int | None = Form(None),
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
    old = ToyOut.model_validate(toy).model_dump(mode="json")
    old_image_path = toy.image_path
    new_image_path: str | None = None
    rerun_embedding = False

    effective_min_age = min_age if min_age is not None else toy.min_age
    effective_max_age = max_age if max_age is not None else toy.max_age
    _validate_age_range(effective_min_age, effective_max_age)

    try:
        if title is not None:
            toy.title = title
        if description is not None:
            toy.description = description
        if min_age is not None:
            toy.min_age = min_age
        if max_age is not None:
            toy.max_age = max_age
        if condition is not None:
            toy.condition = condition
        if date_added is not None:
            toy.date_added = date_added

        if image_file is not None:
            rerun_embedding = True
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
        log_activity(
            type="ToyUpdated",
            user_id=current_user.id,
            toy_id=toy.id,
            new=ToyOut.model_validate(toy).model_dump(mode="json"),
            old=old,
        )
        if rerun_embedding:
            background_tasks.add_task(toy_embedding, toy.id)
    except Exception:
        if new_image_path is not None:
            delete_toy_image(new_image_path)
        raise

    if old_image_path and old_image_path != toy.image_path:
        delete_toy_image(old_image_path)

    return (
        await db.execute(
            select(Toy)
            .where(Toy.id == toy_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


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
    log_activity(
        type="ToyDeleted",
        user_id=current_user.id,
        toy_id=toy.id,
        old=ToyOut.model_validate(toy).model_dump(mode="json"),
    )
