"""Ownership listings and the toy transfer handshake."""

from sqlalchemy import select

from app.models.models import ToyInterest, UserToy
from tests.factories import make_interest, make_toy, make_toy_with_history, make_user


async def user_toy_for(db_session, toy):
    """The open ledger row — the one naming whoever holds the toy right now."""
    return (
        await db_session.execute(
            select(UserToy).where(
                UserToy.toy_id == toy.id, UserToy.released_at.is_(None)
            )
        )
    ).scalar_one()


async def test_list_my_toys_returns_only_the_callers_toys(
    auth_client, db_session, user, other_user
):
    await make_toy(db_session, owner=user, title="Mine")
    await make_toy(db_session, owner=other_user, title="Theirs")

    body = (await auth_client.get("/api/user-toys")).json()

    assert [entry["toy"]["title"] for entry in body] == ["Mine"]


async def test_initiate_transfer_records_the_pending_recipient(
    auth_client, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)

    response = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": other_user.username}
    )

    assert response.status_code == 200
    user_toy = await user_toy_for(db_session, toy)
    await db_session.refresh(user_toy)
    assert user_toy.pending_user_id == other_user.id
    # Ownership does not move until the recipient accepts.
    assert user_toy.user_id == user.id


async def test_transfer_shows_up_for_the_recipient(
    login_as, db_session, user, other_user
):
    """The recipient polls pending-incoming to find transfers awaiting them."""
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    body = (await login_as(other_user).get("/api/user-toys/pending-incoming")).json()

    assert [entry["toy"]["id"] for entry in body] == [toy.id]


async def test_transfer_endpoints_act_on_the_open_row_of_a_toy_with_history(
    auth_client, db_session, user, other_user
):
    """Each endpoint loads one row by toy_id, so history must not confuse them."""
    third_party = await make_user(db_session, username="carol")
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user, third_party]
    )

    initiated = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": other_user.username}
    )
    cancelled = await auth_client.delete(f"/api/user-toys/{toy.id}/transfer")

    assert initiated.status_code == 200
    assert initiated.json()["pending_user"]["username"] == other_user.username
    assert cancelled.status_code == 200
    assert cancelled.json()["pending_user"] is None


async def test_my_toys_ignores_toys_the_caller_has_released(
    login_as, db_session, user, other_user
):
    await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user], title="Handed On"
    )

    body = (await login_as(other_user).get("/api/user-toys")).json()

    assert body == []


async def test_pending_incoming_ignores_closed_rows(
    login_as, db_session, user, other_user
):
    """A transfer that was pending when the row closed is not still incoming."""
    toy = await make_toy_with_history(
        db_session, owner=user, previous_owners=[other_user]
    )
    closed_row = (
        await db_session.execute(
            select(UserToy).where(
                UserToy.toy_id == toy.id, UserToy.released_at.is_not(None)
            )
        )
    ).scalar_one()
    third_party = await make_user(db_session, username="carol")
    closed_row.pending_user_id = third_party.id
    await db_session.flush()

    body = (await login_as(third_party).get("/api/user-toys/pending-incoming")).json()

    assert body == []


async def test_cannot_transfer_a_toy_you_do_not_own(
    auth_client, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=other_user)

    response = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": user.username}
    )

    assert response.status_code == 403


async def test_cannot_transfer_a_toy_to_yourself(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user)

    response = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": user.username}
    )

    assert response.status_code == 400


async def test_cannot_transfer_to_an_unknown_user(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user)

    response = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": "nobody"}
    )

    assert response.status_code == 404


async def test_transfer_of_a_missing_toy_returns_404(auth_client, other_user):
    response = await auth_client.post(
        "/api/user-toys/999999/transfer", json={"to_username": other_user.username}
    )

    assert response.status_code == 404


async def test_accepting_a_transfer_moves_ownership(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    response = await login_as(other_user).post(
        f"/api/user-toys/{toy.id}/transfer/accept"
    )

    assert response.status_code == 200
    open_row = await user_toy_for(db_session, toy)
    assert open_row.user_id == other_user.id
    assert open_row.pending_user_id is None


async def test_accepting_a_transfer_closes_the_previous_stint(
    login_as, db_session, user, other_user
):
    """Ownership is a ledger: the old row is closed, not overwritten."""
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")

    rows = (
        (
            await db_session.execute(
                select(UserToy)
                .where(UserToy.toy_id == toy.id)
                .order_by(UserToy.checked_out_at)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    closed, open_row = rows
    assert closed.user_id == user.id
    assert closed.released_at is not None
    assert closed.source == "created"
    # A stale pending_user_id on a closed row would keep granting the recipient
    # permissions the pending-transfer relationship was supposed to end.
    assert closed.pending_user_id is None
    assert open_row.user_id == other_user.id
    assert open_row.released_at is None
    assert open_row.source == "transferred"


async def test_accepting_a_transfer_returns_the_new_ledger_row(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    body = (
        await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")
    ).json()

    assert body["user"]["username"] == other_user.username
    assert body["pending_user"] is None
    assert body["id"] != user_toy.id


async def test_a_transferred_toy_leaves_the_previous_owners_list(
    login_as, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user, title="Handed On")
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()
    await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")

    previous = (await login_as(user).get("/api/user-toys")).json()
    current = (await login_as(other_user).get("/api/user-toys")).json()

    assert previous == []
    assert [entry["toy"]["id"] for entry in current] == [toy.id]


async def test_a_transferred_toy_can_be_transferred_onward(
    login_as, db_session, user, other_user
):
    """The second handoff is the one that used to hit MultipleResultsFound."""
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()
    await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")

    third_party = await make_user(db_session, username="carol")
    initiated = await login_as(other_user).post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": third_party.username}
    )
    accepted = await login_as(third_party).post(
        f"/api/user-toys/{toy.id}/transfer/accept"
    )

    assert initiated.status_code == 200
    assert accepted.status_code == 200
    open_row = await user_toy_for(db_session, toy)
    assert open_row.user_id == third_party.id


async def test_accepting_a_transfer_clears_the_recipients_interest(
    login_as, db_session, user, other_user
):
    """Owning the toy makes the recipient's own interest row meaningless."""
    toy = await make_toy(db_session, owner=user)
    await make_interest(db_session, user=other_user, toy=toy)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    await login_as(other_user).post(f"/api/user-toys/{toy.id}/transfer/accept")

    remaining = (
        await db_session.execute(
            select(ToyInterest).where(
                ToyInterest.toy_id == toy.id, ToyInterest.user_id == other_user.id
            )
        )
    ).scalar_one_or_none()
    assert remaining is None


async def test_only_the_pending_recipient_can_accept(
    auth_client, db_session, other_user
):
    """A transfer pending for somebody else must not be claimable."""
    toy = await make_toy(db_session, owner=other_user)
    user_toy = await user_toy_for(db_session, toy)
    third_party = await make_user(db_session, username="carol")
    user_toy.pending_user_id = third_party.id
    await db_session.flush()

    response = await auth_client.post(f"/api/user-toys/{toy.id}/transfer/accept")

    assert response.status_code == 403


async def test_accepting_without_a_pending_transfer_is_rejected(
    auth_client, db_session, user
):
    toy = await make_toy(db_session, owner=user)

    response = await auth_client.post(f"/api/user-toys/{toy.id}/transfer/accept")

    assert response.status_code == 400


async def test_owner_can_cancel_a_pending_transfer(
    auth_client, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    response = await auth_client.delete(f"/api/user-toys/{toy.id}/transfer")

    assert response.status_code == 200
    await db_session.refresh(user_toy)
    assert user_toy.pending_user_id is None


async def test_transfer_responses_reflect_the_new_pending_user(
    auth_client, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)

    initiated = await auth_client.post(
        f"/api/user-toys/{toy.id}/transfer", json={"to_username": other_user.username}
    )
    assert initiated.json()["pending_user"]["username"] == other_user.username

    cancelled = await auth_client.delete(f"/api/user-toys/{toy.id}/transfer")
    assert cancelled.json()["pending_user"] is None


async def test_cancelling_without_a_pending_transfer_is_rejected(
    auth_client, db_session, user
):
    toy = await make_toy(db_session, owner=user)

    response = await auth_client.delete(f"/api/user-toys/{toy.id}/transfer")

    assert response.status_code == 400


async def test_only_the_owner_can_cancel(auth_client, db_session, user, other_user):
    toy = await make_toy(db_session, owner=other_user)
    user_toy = await user_toy_for(db_session, toy)
    user_toy.pending_user_id = user.id
    await db_session.flush()

    response = await auth_client.delete(f"/api/user-toys/{toy.id}/transfer")

    assert response.status_code == 403
