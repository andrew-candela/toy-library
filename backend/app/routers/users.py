from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import get_current_user
from app.lib.database import get_db
from app.models.models import Address, User, UserToy
from app.schemas.schemas import PaginatedResponse, UserDetailOut, UserListOut

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[UserListOut])
async def list_users(
    neighborhood: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Build query to select users with their neighborhood and toy count. Toys
    # the user has since handed on are still in user_toys, so the count has to
    # be restricted to the rows they still hold.
    toy_count_subquery = (
        select(func.count(UserToy.id))
        .where(UserToy.user_id == User.id, UserToy.released_at.is_(None))
        .scalar_subquery()
    )

    query = select(
        User.id,
        User.username,
        Address.neighborhood,
        toy_count_subquery.label("toy_count"),
    ).outerjoin(Address, User.id == Address.user_id)

    # Filter: only show verified users, except the current user
    query = query.where((User.is_email_verified) | (User.id == current_user.id))

    # Apply filters
    if neighborhood:
        query = query.where(Address.neighborhood == neighborhood)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(User.username.ilike(search_pattern))

    # Count total results
    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()
    total_pages = max(1, (total + page_size - 1) // page_size)

    # Execute paginated query
    rows = (
        await db.execute(
            query.order_by(User.username)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    # Convert rows to UserListOut objects
    users = []
    for row in rows:
        users.append(
            UserListOut(
                id=row.id,
                username=row.username,
                neighborhood=row.neighborhood,
                toy_count=row.toy_count or 0,
            )
        )

    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/neighborhoods", response_model=list[str])
async def list_neighborhoods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every neighborhood in use, regardless of any active filters.

    Filter dropdowns need the full set of options, so this must not be
    derived from a filtered/paginated listing.
    """
    result = await db.execute(
        select(Address.neighborhood)
        .where(Address.neighborhood.isnot(None))
        .distinct()
        .order_by(Address.neighborhood)
    )
    return result.scalars().all()


@router.get("/username-suggestions", response_model=list[str])
async def suggest_usernames(
    q: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefix = q.strip()
    if not prefix:
        return []
    result = await db.execute(
        select(User.username)
        .where((User.is_email_verified) | (User.id == current_user.id))
        .where(User.username.ilike(f"%{prefix}%"))
        .order_by(User.username)
        .limit(5)
    )
    return result.scalars().all()


@router.get("/{username}", response_model=UserDetailOut)
async def get_user_detail(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get user by username
    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()

    if not user:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="User not found")

    # Get user's address/neighborhood
    address = (
        await db.execute(select(Address).where(Address.user_id == user.id))
    ).scalar_one_or_none()

    # Count toys owned by this user
    toy_count = (
        await db.execute(
            select(func.count(UserToy.id)).where(
                UserToy.user_id == user.id, UserToy.released_at.is_(None)
            )
        )
    ).scalar_one()

    return UserDetailOut(
        id=user.id,
        username=user.username,
        neighborhood=address.neighborhood if address else None,
        toy_count=toy_count or 0,
    )
