"""What a delisted toy must stop doing, and what it must keep.

Deleting a toy sets `toys.deleted_at` and closes the holder's `user_toys` row
instead of removing anything, so the custody ledger survives. That only holds up
if every read path says `deleted_at IS NULL` — the two easy ones to miss are the
primary-key `db.get(Toy, ...)` in interests, which bypasses query filters
entirely, and `selectinload(UserToy.toy)`, which loads through the relationship.
Each test below pins one of those paths.
"""

from datetime import UTC, datetime

from sqlalchemy import select

from app.models.models import Toy, ToyInterest, UserToy
from tests.factories import make_interest, make_toy, make_toy_with_history, make_user

_NOW = datetime(2026, 1, 1, tzinfo=UTC)


async def _delete(client, toy):
    response = await client.delete(f"/api/toys/{toy.id}")
    assert response.status_code == 204
    return response


async def test_delete_closes_the_holders_stint_without_dropping_the_ledger(
    auth_client, db_session, user, other_user
):
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )

    await _delete(auth_client, toy)

    stored = (
        await db_session.execute(
            select(Toy)
            .where(Toy.id == toy.id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    rows = (
        (
            await db_session.execute(
                select(UserToy)
                .where(UserToy.toy_id == toy.id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )

    assert stored.deleted_at is not None
    assert len(rows) == 2
    assert all(row.released_at is not None for row in rows)


async def test_a_deleted_toy_is_absent_from_the_listing(auth_client, db_session, user):
    kept = await make_toy(db_session, owner=user, title="Kept")
    doomed = await make_toy(db_session, owner=user, title="Doomed")

    await _delete(auth_client, doomed)

    body = (await auth_client.get("/api/toys/")).json()

    assert [item["title"] for item in body["items"]] == ["Kept"]
    assert body["total"] == 1
    assert kept.id in {item["id"] for item in body["items"]}


async def test_a_deleted_toy_is_absent_from_semantic_search(
    auth_client, db_session, user
):
    """The listing's search path filters in Python after a `LIMIT 100`, so the
    `deleted_at` filter has to be on the query, not applied to its results."""
    embedding = [1.0] + [0.0] * 767
    await make_toy(db_session, owner=user, title="Kept", embedding=embedding)
    doomed = await make_toy(db_session, owner=user, title="Doomed", embedding=embedding)

    await _delete(auth_client, doomed)

    listing = (await auth_client.get("/api/toys/", params={"search": "train"})).json()
    debug = (
        await auth_client.post("/api/toys/semantic_search", params={"description": "x"})
    ).json()

    assert doomed.id not in {item["id"] for item in listing["items"]}
    assert doomed.id not in {item["id"] for item in debug}


async def test_getting_a_deleted_toy_returns_404(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user)

    await _delete(auth_client, toy)

    assert (await auth_client.get(f"/api/toys/{toy.id}")).status_code == 404


async def test_a_deleted_toy_cannot_be_updated(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user)

    await _delete(auth_client, toy)

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"title": "Revived"})

    assert response.status_code == 404


async def test_a_deleted_toy_cannot_receive_new_interest(
    login_as, db_session, user, other_user
):
    """Covers the primary-key `db.get` path: it answers from the identity map, so
    it hands back soft-deleted rows unless the lookup is an explicit select."""
    toy = await make_toy(db_session, owner=user)

    await _delete(login_as(user), toy)

    response = await login_as(other_user).post(f"/api/interests/{toy.id}")

    assert response.status_code == 404


async def test_a_deleted_toy_has_no_interest_detail(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)
    await make_interest(db_session, user=other_user, toy=toy)

    await _delete(login_as(user), toy)

    assert (await login_as(user).get(f"/api/interests/{toy.id}")).status_code == 404


async def test_deleting_a_toy_drops_the_interests_against_it(
    login_as, db_session, user, other_user
):
    """Interests are hard-deleted by policy everywhere else, and a delisted toy
    should not keep live ones."""
    toy = await make_toy(db_session, owner=user)
    await make_interest(db_session, user=other_user, toy=toy)

    await _delete(login_as(user), toy)

    remaining = (
        (
            await db_session.execute(
                select(ToyInterest).where(ToyInterest.toy_id == toy.id)
            )
        )
        .scalars()
        .all()
    )
    assert remaining == []


async def test_a_deleted_toy_is_absent_from_my_toys(auth_client, db_session, user):
    await make_toy(db_session, owner=user, title="Kept")
    doomed = await make_toy(db_session, owner=user, title="Doomed")

    await _delete(auth_client, doomed)

    body = (await auth_client.get("/api/user-toys")).json()

    assert [entry["toy"]["title"] for entry in body] == ["Kept"]


async def test_my_toys_hides_a_delisted_toy_even_with_its_stint_still_open(
    auth_client, db_session, user
):
    """`selectinload(UserToy.toy)` loads the toy row whatever its deleted_at says.

    Going through the endpoint cannot show that, because closing the stint hides
    the toy on its own — so this sets `deleted_at` directly, leaving the open row
    the relationship would otherwise happily load through.
    """
    await make_toy(db_session, owner=user, title="Kept")
    await make_toy(db_session, owner=user, title="Delisted", deleted_at=_NOW)

    body = (await auth_client.get("/api/user-toys")).json()

    assert [entry["toy"]["title"] for entry in body] == ["Kept"]


MY_TOYS_QUERY = "{ myToys { id title } }"


async def test_a_deleted_toy_is_absent_from_graphql_my_toys(
    auth_client, db_session, user
):
    await make_toy(db_session, owner=user, title="Kept")
    doomed = await make_toy(db_session, owner=user, title="Doomed")

    await _delete(auth_client, doomed)

    body = (await auth_client.post("/graphql", json={"query": MY_TOYS_QUERY})).json()

    assert [toy["title"] for toy in body["data"]["myToys"]] == ["Kept"]


async def test_graphql_my_toys_hides_a_delisted_toy_with_its_stint_still_open(
    auth_client, db_session, user
):
    """The GraphQL resolver loads through the same relationship, so it needs the
    same join rather than trusting `released_at` to have been closed."""
    await make_toy(db_session, owner=user, title="Kept")
    await make_toy(db_session, owner=user, title="Delisted", deleted_at=_NOW)

    body = (await auth_client.post("/graphql", json={"query": MY_TOYS_QUERY})).json()

    assert [toy["title"] for toy in body["data"]["myToys"]] == ["Kept"]


async def test_deleting_an_already_deleted_toy_returns_404(
    auth_client, db_session, user
):
    """Not the 409 the missing-ownership guard would otherwise produce: after the
    first delete there is no open user_toys row left for it to find."""
    toy = await make_toy(db_session, owner=user)

    await _delete(auth_client, toy)

    assert (await auth_client.delete(f"/api/toys/{toy.id}")).status_code == 404


async def test_deleting_a_toy_drops_the_owners_toy_count(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user)
    before = (await auth_client.get(f"/api/users/{user.username}")).json()["toy_count"]

    await _delete(auth_client, toy)

    after = (await auth_client.get(f"/api/users/{user.username}")).json()["toy_count"]

    assert (before, after) == (1, 0)


async def test_a_deleted_toy_stops_gating_who_the_owner_can_message(
    login_as, db_session, user, other_user
):
    """Contact permission comes from a live listing, and delisting ends that."""
    toy = await make_toy(db_session, owner=user)
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    await _delete(login_as(user), toy)

    response = await login_as(user).post(
        "/api/user-messages/send",
        json={"to_username": interested.username, "message": "Still yours?"},
    )

    assert response.status_code == 403


async def test_deleting_a_toy_removes_its_image_but_keeps_the_row(
    auth_client, db_session, user, image_storage_dir
):
    stored = image_storage_dir / "doomed.png"
    stored.write_bytes(b"data")
    toy = await make_toy(db_session, owner=user, image_path="/images/doomed.png")

    await _delete(auth_client, toy)

    reloaded = (
        await db_session.execute(
            select(Toy)
            .where(Toy.id == toy.id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert not stored.exists()
    assert reloaded.image_path is None
