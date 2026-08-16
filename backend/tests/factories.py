"""Helpers for putting rows in the database.

These build the minimum a test needs and let callers override anything they are
actually asserting on, so a test reads as "a toy with these tags" rather than as
a wall of unrelated field assignments.
"""

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.auth import hash_password
from app.models.models import (
    Address,
    AllowList,
    Toy,
    ToyCondition,
    ToyInterest,
    ToyTag,
    User,
    UserToy,
)

DEFAULT_PASSWORD = "correct-horse-battery-staple"


async def make_user(
    db: AsyncSession,
    *,
    username: str = "user",
    email: str | None = None,
    password: str = DEFAULT_PASSWORD,
    is_email_verified: bool = True,
    neighborhood: str | None = None,
    with_address: bool = True,
) -> User:
    user = User(
        username=username,
        email=email or f"{username}@example.com",
        hashed_password=hash_password(password),
        is_email_verified=is_email_verified,
    )
    db.add(user)
    await db.flush()

    # register() always creates an Address alongside the user, so tests that
    # filter by neighborhood see the same shape production does. Pass
    # with_address=False when the test deletes the user: User.address has no
    # cascade configured, so SQLAlchemy tries to null out addresses.user_id
    # rather than letting the FK's ON DELETE CASCADE handle it.
    if with_address:
        db.add(Address(user_id=user.id, neighborhood=neighborhood))
        await db.flush()
    return user


async def make_toy(
    db: AsyncSession,
    *,
    owner: User | None = None,
    title: str = "Wooden Train",
    description: str | None = None,
    min_age: int | None = None,
    max_age: int | None = None,
    tags: list[str] | None = None,
    condition: ToyCondition | None = None,
    image_path: str | None = None,
    date_added: datetime | None = None,
) -> Toy:
    toy = Toy(
        title=title,
        description=description,
        min_age=min_age,
        max_age=max_age,
        condition=condition,
        image_path=image_path,
        date_added=date_added,
    )
    db.add(toy)
    await db.flush()

    for tag in tags or []:
        db.add(ToyTag(toy_id=toy.id, tag=tag))

    if owner is not None:
        db.add(
            UserToy(
                user_id=owner.id,
                toy_id=toy.id,
                checked_out_at=datetime.now(tz=timezone.utc),
            )
        )

    await db.flush()
    return toy


async def make_interest(db: AsyncSession, *, user: User, toy: Toy) -> ToyInterest:
    interest = ToyInterest(
        user_id=user.id, toy_id=toy.id, created_at=datetime.now(tz=timezone.utc)
    )
    db.add(interest)
    await db.flush()
    return interest


async def allow_email(db: AsyncSession, email: str) -> AllowList:
    """Registration rejects any address that is not on the allowlist."""
    entry = AllowList(email=email)
    db.add(entry)
    await db.flush()
    return entry
