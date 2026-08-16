"""Registration, login, email verification, password reset, and logout."""

from sqlalchemy import select

from app.lib.auth import create_access_token, verify_password
from app.lib.redis import get_redis_client
from app.models.models import Address, User
from tests.factories import DEFAULT_PASSWORD, allow_email, make_user

REGISTRATION = {
    "username": "newcomer",
    "email": "newcomer@example.com",
    "password": "a-good-password",
}


async def register(client, db_session, **overrides):
    body = {**REGISTRATION, **overrides}
    await allow_email(db_session, body["email"])
    return await client.post("/api/auth/register", json=body)


async def test_register_creates_an_unverified_user(client, db_session):
    response = await register(client, db_session)

    assert response.status_code == 201
    assert response.json()["is_email_verified"] is False

    user = (
        await db_session.execute(
            select(User).where(User.username == REGISTRATION["username"])
        )
    ).scalar_one()
    assert user.email == REGISTRATION["email"]


async def test_register_never_stores_the_plaintext_password(client, db_session):
    await register(client, db_session)

    user = (
        await db_session.execute(
            select(User).where(User.username == REGISTRATION["username"])
        )
    ).scalar_one()
    assert user.hashed_password != REGISTRATION["password"]
    assert verify_password(REGISTRATION["password"], user.hashed_password)


async def test_register_creates_an_address_row(client, db_session):
    """Neighborhood filtering joins through addresses, so a user without one
    would silently disappear from filtered toy listings."""
    await register(client, db_session)

    user = (
        await db_session.execute(
            select(User).where(User.username == REGISTRATION["username"])
        )
    ).scalar_one()
    address = (
        await db_session.execute(select(Address).where(Address.user_id == user.id))
    ).scalar_one()
    assert address.neighborhood is None


async def test_register_rejects_an_email_that_is_not_on_the_allowlist(client):
    response = await client.post("/api/auth/register", json=REGISTRATION)

    assert response.status_code == 401


async def test_register_rejects_a_duplicate_username(client, db_session, user):
    response = await register(
        client, db_session, username=user.username, email="different@example.com"
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Username already registered"


async def test_register_rejects_a_duplicate_email(client, db_session, user):
    response = await register(
        client, db_session, username="different", email=user.email
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


async def test_login_returns_a_bearer_token(client, user):
    response = await client.post(
        "/api/auth/login",
        data={"username": user.username, "password": DEFAULT_PASSWORD},
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


async def test_login_rejects_a_wrong_password(client, user):
    response = await client.post(
        "/api/auth/login",
        data={"username": user.username, "password": "not-the-password"},
    )

    assert response.status_code == 401


async def test_login_rejects_an_unknown_username(client):
    response = await client.post(
        "/api/auth/login", data={"username": "ghost", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 401


async def test_login_is_blocked_until_the_email_is_verified(client, db_session):
    unverified = await make_user(
        db_session, username="unverified", is_email_verified=False
    )

    response = await client.post(
        "/api/auth/login",
        data={"username": unverified.username, "password": DEFAULT_PASSWORD},
    )

    assert response.status_code == 403
    assert "not verified" in response.json()["detail"]


async def test_verify_email_marks_the_user_verified_and_burns_the_token(
    client, db_session
):
    await register(client, db_session)
    user = (
        await db_session.execute(
            select(User).where(User.username == REGISTRATION["username"])
        )
    ).scalar_one()
    token = await get_redis_client().get(f"verify_email_user:{user.id}")

    response = await client.get("/api/auth/verify-email", params={"token": token})

    assert response.status_code == 200
    await db_session.refresh(user)
    assert user.is_email_verified is True

    # A verification link must not be replayable.
    replay = await client.get("/api/auth/verify-email", params={"token": token})
    assert replay.status_code == 400


async def test_verify_email_rejects_an_unknown_token(client):
    response = await client.get(
        "/api/auth/verify-email", params={"token": "not-a-real-token"}
    )

    assert response.status_code == 400


async def test_resend_verification_invalidates_the_previous_token(client, db_session):
    await register(client, db_session)
    user = (
        await db_session.execute(
            select(User).where(User.username == REGISTRATION["username"])
        )
    ).scalar_one()
    first_token = await get_redis_client().get(f"verify_email_user:{user.id}")

    await client.post(
        "/api/auth/resend-verification", json={"email": REGISTRATION["email"]}
    )
    second_token = await get_redis_client().get(f"verify_email_user:{user.id}")

    assert second_token != first_token
    assert await get_redis_client().get(f"verify_email:{first_token}") is None


async def test_resend_verification_does_not_reveal_whether_an_email_exists(
    client, user
):
    """Same status and body for a registered, a verified, and an unknown
    address — otherwise the endpoint enumerates accounts."""
    unknown = await client.post(
        "/api/auth/resend-verification", json={"email": "nobody@example.com"}
    )
    verified = await client.post(
        "/api/auth/resend-verification", json={"email": user.email}
    )

    assert unknown.status_code == verified.status_code == 200
    assert unknown.json() == verified.json()


async def test_forgot_password_does_not_reveal_whether_an_email_exists(client, user):
    unknown = await client.post(
        "/api/auth/forgot-password", json={"email": "nobody@example.com"}
    )
    known = await client.post("/api/auth/forgot-password", json={"email": user.email})

    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()


async def test_reset_password_changes_the_password_and_burns_the_token(
    client, db_session, user
):
    await client.post("/api/auth/forgot-password", json={"email": user.email})
    token = await get_redis_client().get(f"reset_password_user:{user.id}")

    response = await client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "brand-new"}
    )

    assert response.status_code == 200
    await db_session.refresh(user)
    assert verify_password("brand-new", user.hashed_password)

    replay = await client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "again"}
    )
    assert replay.status_code == 400


async def test_forgot_password_invalidates_the_previous_reset_token(client, user):
    await client.post("/api/auth/forgot-password", json={"email": user.email})
    first_token = await get_redis_client().get(f"reset_password_user:{user.id}")

    await client.post("/api/auth/forgot-password", json={"email": user.email})

    assert await get_redis_client().get(f"reset_password:{first_token}") is None


async def test_reset_password_rejects_an_unknown_token(client):
    response = await client.post(
        "/api/auth/reset-password", json={"token": "made-up", "new_password": "x"}
    )

    assert response.status_code == 400


async def test_logout_revokes_the_token_it_was_called_with(client, user):
    token = create_access_token(user.username)
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.post("/api/auth/logout", headers=headers)).status_code == 200

    # The blocklist is the whole point: the same token must stop working.
    replay = await client.get("/api/user-toys", headers=headers)
    assert replay.status_code == 401


async def test_logout_leaves_other_sessions_alone(client, user):
    """Tokens are blocklisted by jti, so revoking one must not revoke the rest."""
    revoked = create_access_token(user.username)
    still_valid = create_access_token(user.username)

    await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {revoked}"})

    response = await client.get(
        "/api/user-toys", headers={"Authorization": f"Bearer {still_valid}"}
    )
    assert response.status_code == 200


async def test_protected_route_rejects_a_missing_token(client):
    assert (await client.get("/api/user-toys")).status_code == 401


async def test_protected_route_rejects_a_garbage_token(client):
    response = await client.get(
        "/api/user-toys", headers={"Authorization": "Bearer not.a.jwt"}
    )

    assert response.status_code == 401


async def test_protected_route_rejects_a_token_for_a_deleted_user(client, db_session):
    """The token stays cryptographically valid after the user row is gone."""
    ghost = await make_user(db_session, username="ghost", with_address=False)
    token = create_access_token(ghost.username)
    await db_session.delete(ghost)
    await db_session.flush()

    response = await client.get(
        "/api/user-toys", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401
