"""The two staleness clocks on `toys`, and which writes move which.

Nothing reads these columns yet — they exist so the filter that eventually
hides quiet listings has real history to work against. That makes them easy to
get subtly wrong without anything failing, so each write site is pinned here:
owner edits move `last_owner_activity_at`, outside interest moves
`last_interest_at`, and the two never move together except at creation.

The load-bearing one is the last test. Interests are hard-deleted, so the
obvious "keep the column consistent with the rows" instinct — clearing or
recomputing `last_interest_at` on withdrawal — would reintroduce exactly the
lossiness the denormalized column exists to avoid.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.models import Toy
from tests.factories import make_interest, make_toy

_LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)


async def _reload(db_session, toy_id: int) -> Toy:
    """Re-read the row, ignoring whatever the identity map is holding.

    The routers commit into the test's savepoint, so the session already has a
    `Toy` for this id; without `populate_existing` these assertions would read
    back the stale in-memory values rather than what was written.
    """
    return (
        await db_session.execute(
            select(Toy)
            .where(Toy.id == toy_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


async def test_create_toy_starts_both_clocks(auth_client, db_session):
    before = datetime.now(tz=UTC)

    response = await auth_client.post("/api/toys", data={"title": "New Blocks"})

    assert response.status_code == 201
    toy = await _reload(db_session, response.json()["id"])
    assert toy.last_owner_activity_at is not None
    assert toy.last_interest_at is not None
    assert toy.last_owner_activity_at >= before
    assert toy.last_interest_at >= before


async def test_update_toy_bumps_owner_activity(auth_client, db_session, user):
    toy = await make_toy(
        db_session, owner=user, title="Old", last_owner_activity_at=_LONG_AGO
    )

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"title": "New"})

    assert response.status_code == 200
    assert (await _reload(db_session, toy.id)).last_owner_activity_at > _LONG_AGO


async def test_update_toy_leaves_interest_alone(auth_client, db_session, user):
    """An owner editing their own listing is not somebody else wanting it."""
    toy = await make_toy(db_session, owner=user, last_interest_at=_LONG_AGO)

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"title": "New"})

    assert response.status_code == 200
    assert (await _reload(db_session, toy.id)).last_interest_at == _LONG_AGO


async def test_express_interest_bumps_the_toys_interest_clock(
    client, login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user, last_interest_at=_LONG_AGO)

    response = await login_as(other_user).post(f"/api/interests/{toy.id}")

    assert response.status_code == 201
    assert (await _reload(db_session, toy.id)).last_interest_at > _LONG_AGO


async def test_express_interest_leaves_owner_activity_alone(
    client, login_as, db_session, user, other_user
):
    """Somebody else asking is not the owner tending the listing."""
    # Stale enough that a bump would be unmistakable, but inside the expiry
    # window: `_LONG_AGO` would make the toy expired, and `other_user` would get
    # a 404 from the interest endpoint before reaching the clock at all.
    tended_at = datetime.now(tz=UTC) - timedelta(days=2)
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=tended_at)

    response = await login_as(other_user).post(f"/api/interests/{toy.id}")

    assert response.status_code == 201
    assert (await _reload(db_session, toy.id)).last_owner_activity_at == tended_at


async def test_withdrawing_interest_does_not_rewind_the_interest_clock(
    client, login_as, db_session, user, other_user
):
    """The one that will look like a bug to somebody tidying up later.

    The interest row is gone after this, so a `max(created_at)` over what
    survives would answer NULL. The column keeps the fact that interest was
    shown, which is the whole reason it is denormalized.
    """
    toy = await make_toy(db_session, owner=user)
    await make_interest(db_session, user=other_user, toy=toy)
    interest_shown_at = datetime.now(tz=UTC) - timedelta(days=1)
    toy.last_interest_at = interest_shown_at
    await db_session.flush()

    response = await login_as(other_user).delete(f"/api/interests/{toy.id}")

    assert response.status_code == 204
    assert (await _reload(db_session, toy.id)).last_interest_at == interest_shown_at
