"""Token minting and password hashing — no database, no Redis."""

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.lib import auth

pytestmark = pytest.mark.unit


def test_access_token_round_trips_the_subject():
    token = auth.create_access_token("alice")

    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])

    assert payload["sub"] == "alice"


def test_each_access_token_gets_a_distinct_jti():
    """Logout blocklists by jti, so a shared id would revoke every token at once."""
    first = jwt.decode(
        auth.create_access_token("alice"), auth.SECRET_KEY, algorithms=[auth.ALGORITHM]
    )
    second = jwt.decode(
        auth.create_access_token("alice"), auth.SECRET_KEY, algorithms=[auth.ALGORITHM]
    )

    assert first["jti"] != second["jti"]


def test_access_token_expires_within_the_configured_window():
    token = auth.create_access_token("alice")

    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    expected = datetime.now(timezone.utc) + timedelta(
        minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    assert abs((expires_at - expected).total_seconds()) < 60


def test_token_signed_with_a_different_secret_is_rejected():
    forged = jwt.encode(
        {"sub": "alice", "jti": "x"}, "some-other-secret", algorithm=auth.ALGORITHM
    )

    with pytest.raises(Exception):
        jwt.decode(forged, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])


def test_password_hash_verifies_against_the_original():
    hashed = auth.hash_password("hunter2")

    assert hashed != "hunter2"
    assert auth.verify_password("hunter2", hashed)
    assert not auth.verify_password("hunter3", hashed)


def test_password_hashing_is_salted():
    assert auth.hash_password("hunter2") != auth.hash_password("hunter2")
