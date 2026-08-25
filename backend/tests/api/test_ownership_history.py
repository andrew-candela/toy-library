"""What a toy's custody history must not do to the rest of the app.

`user_toys` keeps a closed row for every past holder, so any query that reads it
without `released_at IS NULL` either raises MultipleResultsFound or answers with
somebody who gave the toy away years ago. These tests pin the endpoints that
were audited when the ledger landed — one per way that used to go wrong.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.models import Toy, UserToy
from tests.factories import make_interest, make_toy, make_toy_with_history, make_user


async def test_get_toy_reports_only_the_current_owner(
    auth_client, db_session, user, other_user
):
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )

    body = (await auth_client.get(f"/api/toys/{toy.id}")).json()

    assert body["owner_username"] == user.username


async def test_toy_listing_filters_match_only_the_current_owner(
    login_as, db_session, user, other_user
):
    """A former owner's filters must not surface the toy as still theirs."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user], title="Handed On"
    )

    former_owner_client = login_as(other_user)
    owned = (
        await former_owner_client.get(
            "/api/toys/", params={"owned_by_current_user": True}
        )
    ).json()
    by_username = (
        await former_owner_client.get(
            "/api/toys/", params={"owner_username": other_user.username}
        )
    ).json()

    assert owned["items"] == []
    assert by_username["items"] == []
    still_listed = (
        await former_owner_client.get(
            "/api/toys/", params={"owner_username": user.username}
        )
    ).json()
    assert [item["id"] for item in still_listed["items"]] == [toy.id]


async def test_listing_reports_the_current_owners_neighborhood(auth_client, db_session):
    """The neighborhood lookup used to let an arbitrary historical row win."""
    former_owner = await make_user(
        db_session, username="carol", neighborhood="Old Town"
    )
    current_owner = await make_user(
        db_session, username="dave", neighborhood="New Town"
    )
    await make_toy_with_history(
        db_session, owner=current_owner, previous_owners=[former_owner]
    )

    body = (await auth_client.get("/api/toys/")).json()

    assert [item["neighborhood"] for item in body["items"]] == ["New Town"]


async def test_neighborhood_filter_ignores_a_former_owners_neighborhood(
    auth_client, db_session
):
    former_owner = await make_user(
        db_session, username="carol", neighborhood="Old Town"
    )
    current_owner = await make_user(
        db_session, username="dave", neighborhood="New Town"
    )
    await make_toy_with_history(
        db_session, owner=current_owner, previous_owners=[former_owner]
    )

    body = (
        await auth_client.get("/api/toys/", params={"neighborhood": "Old Town"})
    ).json()

    assert body["items"] == []


async def test_deleting_a_toy_leaves_its_whole_history_intact(
    login_as, db_session, user, other_user
):
    """The reason delete is soft: a hard delete cascaded the ledger away."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )

    response = await login_as(user).delete(f"/api/toys/{toy.id}")

    assert response.status_code == 204
    remaining = (
        (
            await db_session.execute(
                select(UserToy)
                .where(UserToy.toy_id == toy.id)
                .order_by(UserToy.checked_out_at)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    assert [row.user_id for row in remaining] == [other_user.id, user.id]
    # Every stint is closed now, the current holder's included.
    assert all(row.released_at is not None for row in remaining)


async def test_user_list_toy_count_excludes_released_toys(
    auth_client, db_session, user, other_user
):
    await make_toy_with_history(db_session, owner=user, previous_owners=[other_user])

    body = (await auth_client.get("/api/users/")).json()
    counts = {entry["username"]: entry["toy_count"] for entry in body["items"]}

    assert counts[user.username] == 1
    assert counts[other_user.username] == 0


async def test_user_detail_toy_count_excludes_released_toys(
    auth_client, db_session, user, other_user
):
    await make_toy_with_history(db_session, owner=user, previous_owners=[other_user])

    body = (await auth_client.get(f"/api/users/{other_user.username}")).json()

    assert body["toy_count"] == 0


async def test_a_former_owner_cannot_see_interested_usernames(
    login_as, db_session, user, other_user
):
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    body = (await login_as(other_user).get(f"/api/interests/{toy.id}")).json()

    assert body["interested_count"] == 1
    assert body["can_view_usernames"] is False
    assert body["interested_usernames"] == []


async def test_the_current_owner_still_sees_interested_usernames(
    login_as, db_session, user, other_user
):
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    body = (await login_as(user).get(f"/api/interests/{toy.id}")).json()

    assert body["can_view_usernames"] is True
    assert [entry["username"] for entry in body["interested_usernames"]] == [
        interested.username
    ]


async def test_a_former_owner_cannot_message_someone_interested_in_the_toy(
    login_as, db_session, user, other_user
):
    """Contact permission comes from a live relationship, not a lapsed one."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    response = await login_as(other_user).post(
        "/api/user-messages/send",
        json={"to_username": interested.username, "message": "Still available?"},
    )

    assert response.status_code == 403


async def test_the_current_owner_can_message_someone_interested_in_the_toy(
    login_as, db_session, user, other_user
):
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    response = await login_as(user).post(
        "/api/user-messages/send",
        json={"to_username": interested.username, "message": "It is yours if you want"},
    )

    assert response.status_code == 200


async def test_someone_interested_cannot_be_messaged_by_a_former_owner_either_way(
    login_as, db_session, user, other_user
):
    """The reverse-direction check is scoped to open rows too."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    interested = await make_user(db_session, username="carol")
    await make_interest(db_session, user=interested, toy=toy)

    response = await login_as(interested).post(
        "/api/user-messages/send",
        json={"to_username": other_user.username, "message": "Do you still have it?"},
    )

    assert response.status_code == 403


MY_TOYS_QUERY = "{ myToys { id title } }"


async def test_graphql_my_toys_excludes_toys_the_caller_released(
    login_as, db_session, user, other_user
):
    await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user], title="Handed On"
    )

    former_owner = (
        await login_as(other_user).post("/graphql", json={"query": MY_TOYS_QUERY})
    ).json()
    current_owner = (
        await login_as(user).post("/graphql", json={"query": MY_TOYS_QUERY})
    ).json()

    assert former_owner["data"]["myToys"] == []
    assert [toy["title"] for toy in current_owner["data"]["myToys"]] == ["Handed On"]


async def test_the_toy_user_toy_relationship_loads_only_the_open_row(
    db_session, user, other_user
):
    """Toy.user_toy is uselist=False, so its primaryjoin has to exclude history."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )

    loaded = (
        await db_session.execute(
            select(Toy).options(selectinload(Toy.user_toy)).where(Toy.id == toy.id)
        )
    ).scalar_one()

    assert loaded.user_toy.user_id == user.id


async def test_a_second_open_row_for_one_toy_is_rejected(db_session, user, other_user):
    """The partial unique index carries the one-holder-per-toy invariant now."""
    toy = await make_toy(db_session, owner=user)

    db_session.add(
        UserToy(
            user_id=other_user.id,
            toy_id=toy.id,
            checked_out_at=datetime.now(tz=UTC),
        )
    )

    with pytest.raises(IntegrityError):
        await db_session.flush()
