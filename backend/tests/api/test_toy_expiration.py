"""Who can see a toy that has gone quiet, and how it comes back.

Expiry is derived at read time from two independent signals — live interest and
`last_owner_activity_at` — so there is no stored flag to assert on. These tests
drive it the way the app does: through the endpoints, with the clock wound back
by the factory.

The pairs that matter are the ones where the two signals disagree. A toy nobody
has touched in a year is still listed while somebody wants it, and a toy the
owner edited this morning is listed whether or not anyone does. Only both at
once hides it — and even then, never from its owner.
"""

from datetime import UTC, datetime, timedelta

from app.lib.toy_expiration import EXPIRY_WARNING_WINDOW, INACTIVITY_WINDOW
from tests.factories import make_interest, make_toy

_STALE = datetime.now(tz=UTC) - INACTIVITY_WINDOW - timedelta(days=1)
_FRESH = datetime.now(tz=UTC) - timedelta(days=1)


def _ids(payload) -> list[int]:
    return [item["id"] for item in payload["items"]]


async def _listing(client) -> dict:
    response = await client.get("/api/toys/")
    assert response.status_code == 200
    return response.json()


# --- What expiry hides -------------------------------------------------------


async def test_stale_toy_disappears_from_the_catalog(
    login_as, db_session, user, other_user
):
    toy = await make_toy(
        db_session, owner=user, title="Forgotten", last_owner_activity_at=_STALE
    )

    assert toy.id not in _ids(await _listing(login_as(other_user)))


async def test_stale_toy_is_a_404_to_everyone_else(
    login_as, db_session, user, other_user
):
    """Not a 403: telling a stranger the toy exists is the leak itself."""
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)

    response = await login_as(other_user).get(f"/api/toys/{toy.id}")

    assert response.status_code == 404


async def test_stale_toy_cannot_be_reached_through_the_interest_endpoints(
    login_as, db_session, user, other_user
):
    """The interest router is the obvious side door onto a hidden listing.

    Expressing interest un-expires the toy, so a miss here would let anyone who
    knows an id pull a listing back into everyone's catalog.
    """
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    stranger = login_as(other_user)

    assert (await stranger.get(f"/api/interests/{toy.id}")).status_code == 404
    assert (await stranger.post(f"/api/interests/{toy.id}")).status_code == 404


async def test_stale_toy_cannot_be_edited_by_a_stranger(
    login_as, db_session, user, other_user
):
    """Editing bumps the owner-activity clock, so this is a resurrection path."""
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)

    response = await login_as(other_user).put(
        f"/api/toys/{toy.id}", data={"title": "Resurrected"}
    )

    assert response.status_code == 404


# --- What keeps a toy alive --------------------------------------------------


async def test_interest_keeps_a_toy_listed_however_stale_the_owner_clock_is(
    login_as, db_session, user, other_user
):
    """The half of the rule that is easy to drop.

    Reading staleness off `last_owner_activity_at` alone would hide this toy,
    even though somebody is actively asking about it right now.
    """
    toy = await make_toy(
        db_session, owner=user, title="Wanted", last_owner_activity_at=_STALE
    )
    await make_interest(db_session, user=other_user, toy=toy)

    body = await _listing(login_as(other_user))

    assert toy.id in _ids(body)
    assert (await login_as(other_user).get(f"/api/toys/{toy.id}")).status_code == 200


async def test_recent_owner_activity_keeps_a_toy_listed_with_nobody_interested(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_FRESH)

    assert toy.id in _ids(await _listing(login_as(other_user)))


async def test_withdrawing_the_last_interest_can_expire_a_toy(
    login_as, db_session, user, other_user
):
    """Expiry is derived, so it takes effect on the next read — no sweep needed."""
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    await make_interest(db_session, user=other_user, toy=toy)
    stranger = login_as(other_user)

    assert toy.id in _ids(await _listing(stranger))

    assert (await stranger.delete(f"/api/interests/{toy.id}")).status_code == 204

    assert toy.id not in _ids(await _listing(stranger))


# --- What the owner still sees -----------------------------------------------


async def test_owner_still_sees_their_expired_toy_everywhere(
    auth_client, db_session, user
):
    toy = await make_toy(
        db_session, owner=user, title="Mine", last_owner_activity_at=_STALE
    )

    listing = await _listing(auth_client)
    detail = await auth_client.get(f"/api/toys/{toy.id}")

    assert toy.id in _ids(listing)
    assert detail.status_code == 200
    assert detail.json()["is_expired"] is True


async def test_owner_can_still_edit_their_expired_toy(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"title": "Edited"})

    assert response.status_code == 200
    assert response.json()["title"] == "Edited"
    # Editing is owner activity, so the toy is back in the catalog as a side
    # effect — the owner does not have to also hit Refresh.
    assert response.json()["is_expired"] is False


async def test_expired_flag_is_only_ever_set_on_your_own_toys(
    login_as, db_session, user, other_user
):
    """Nobody else's expired toy can reach the client, so the flag needs no
    ownership check alongside it in the UI."""
    await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    await make_toy(db_session, owner=other_user, last_owner_activity_at=_FRESH)

    body = await _listing(login_as(other_user))

    assert all(item["is_expired"] is False for item in body["items"])


# --- The deadline the owner is shown ----------------------------------------


async def test_expires_at_is_a_month_after_the_last_owner_activity(
    auth_client, db_session, user
):
    tended_at = datetime.now(tz=UTC) - timedelta(days=3)
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=tended_at)

    body = (await auth_client.get(f"/api/toys/{toy.id}")).json()

    assert body["is_expired"] is False
    assert datetime.fromisoformat(body["expires_at"]) == tended_at + INACTIVITY_WINDOW


async def test_a_wanted_toy_reports_no_deadline(login_as, db_session, user, other_user):
    """`expires_at` is null because the clock is not running, not because it is
    far off — an interested party keeps the toy listed indefinitely."""
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    await make_interest(db_session, user=other_user, toy=toy)

    body = (await login_as(user).get(f"/api/toys/{toy.id}")).json()

    assert body["is_expired"] is False
    assert body["expires_at"] is None


async def test_a_toy_inside_the_warning_window_reports_a_deadline_in_range(
    auth_client, db_session, user
):
    """What the frontend renders the "expiring soon" nudge from."""
    tended_at = datetime.now(tz=UTC) - INACTIVITY_WINDOW + timedelta(days=3)
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=tended_at)

    body = (await auth_client.get(f"/api/toys/{toy.id}")).json()

    assert body["is_expired"] is False
    expires_at = datetime.fromisoformat(body["expires_at"])
    assert (
        datetime.now(tz=UTC)
        < expires_at
        < datetime.now(tz=UTC) + (EXPIRY_WARNING_WINDOW)
    )


# --- Refresh -----------------------------------------------------------------


async def test_refresh_brings_an_expired_toy_back(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    stranger = login_as(other_user)
    assert toy.id not in _ids(await _listing(stranger))

    response = await login_as(user).post(f"/api/toys/{toy.id}/refresh")

    assert response.status_code == 200
    assert response.json()["is_expired"] is False
    assert toy.id in _ids(await _listing(login_as(other_user)))


async def test_refresh_pushes_the_deadline_a_full_month_out(
    auth_client, db_session, user
):
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)
    before = datetime.now(tz=UTC)

    body = (await auth_client.post(f"/api/toys/{toy.id}/refresh")).json()

    assert datetime.fromisoformat(body["expires_at"]) >= before + INACTIVITY_WINDOW


async def test_refresh_rejects_someone_who_does_not_own_the_toy(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user, last_owner_activity_at=_STALE)

    response = await login_as(other_user).post(f"/api/toys/{toy.id}/refresh")

    assert response.status_code == 403


async def test_refresh_leaves_the_interest_clock_alone(auth_client, db_session, user):
    """The owner is not an interested party in their own toy."""
    toy = await make_toy(
        db_session, owner=user, last_interest_at=_STALE, last_owner_activity_at=_STALE
    )

    assert (await auth_client.post(f"/api/toys/{toy.id}/refresh")).status_code == 200

    await db_session.refresh(toy)
    assert toy.last_interest_at == _STALE


async def test_refresh_404s_for_a_delisted_toy(auth_client, db_session, user):
    """Soft delete and expiry are independent, and refresh must not undo one."""
    toy = await make_toy(
        db_session,
        owner=user,
        deleted_at=datetime.now(tz=UTC),
        last_owner_activity_at=_STALE,
    )

    assert (await auth_client.post(f"/api/toys/{toy.id}/refresh")).status_code == 404


async def test_accepting_a_transfer_restarts_the_clock_for_the_new_owner(
    login_as, db_session, user, other_user
):
    """Otherwise the recipient inherits a listing that expires out from under them."""
    toy = await make_toy(
        db_session, owner=user, last_owner_activity_at=_FRESH - timedelta(days=25)
    )

    await login_as(user).post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": other_user.username}
    )
    accept = await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")
    assert accept.status_code == 200

    body = (await login_as(other_user).get(f"/api/toys/{toy.id}")).json()
    assert datetime.fromisoformat(body["expires_at"]) > datetime.now(
        tz=UTC
    ) + INACTIVITY_WINDOW - timedelta(minutes=1)
