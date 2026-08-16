"""Fixtures for tests that drive the ASGI app against real Postgres and Redis.

Everything here is scoped to tests/api/, so the unit tier stays runnable with no
services. Connection details come from the env block in tests/conftest.py.
"""

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.lib.auth import create_access_token
from app.lib.database import get_db
from app.lib.redis import connect_redis, disconnect_redis, get_redis_client
from app.main import app
from app.models.models import User
from tests.conftest import BACKEND_ROOT, TEST_DATABASE_URL
from tests.factories import make_user

pytestmark = pytest.mark.api

ASYNC_TEST_DATABASE_URL = TEST_DATABASE_URL.replace(
    "postgresql://", "postgresql+asyncpg://", 1
)


def _ensure_test_database_exists() -> None:
    """Create the test database if it is missing.

    In CI the service container creates it up front; this is for the first local
    run, so a developer does not have to remember `createdb toy_library_test`.
    """
    from urllib.parse import urlparse

    import psycopg2
    from psycopg2 import sql

    db_name = urlparse(TEST_DATABASE_URL).path.lstrip("/")
    admin_url = TEST_DATABASE_URL.replace(f"/{db_name}", "/postgres", 1)

    connection = psycopg2.connect(admin_url)
    try:
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            if cursor.fetchone() is None:
                cursor.execute(
                    sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name))
                )
    finally:
        connection.close()


@pytest.fixture(scope="session")
def migrated_database() -> None:
    """Build the schema once per session by running the real migrations.

    Running alembic rather than `Base.metadata.create_all` means CI exercises the
    same migration chain production does — including the `CREATE EXTENSION
    vector` in p2q3r4s5t6u7 that the pgvector columns depend on.
    """
    _ensure_test_database_exists()

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(config, "head")


@pytest_asyncio.fixture(scope="session")
async def engine(migrated_database):
    engine = create_async_engine(ASYNC_TEST_DATABASE_URL)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def redis_connection():
    """Open the module-global Redis pool the app expects.

    app/main.py normally does this in its lifespan handler, but httpx's
    ASGITransport does not run lifespan events, so get_redis_client() would
    raise on the first request that touches auth or rate limiting.
    """
    await connect_redis()
    yield
    await disconnect_redis()


@pytest_asyncio.fixture(autouse=True)
async def clean_redis(redis_connection):
    """Drop keys between tests so rate-limit counters and one-shot email tokens
    from one test cannot leak into the next."""
    await get_redis_client().flushdb()
    yield


@pytest_asyncio.fixture
async def db_session(engine):
    """A session whose writes are discarded at the end of the test.

    The session is bound to a connection with an already-open transaction. Under
    ``join_transaction_mode="create_savepoint"`` a router's own
    ``await db.commit()`` only releases a savepoint, so the outer rollback below
    still undoes everything. That is substantially faster than truncating tables
    between tests, and keeps tests independent of execution order.
    """
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    """An HTTP client bound to the app, sharing the test's rolled-back session."""
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def user(db_session) -> User:
    return await make_user(db_session, username="alice", email="alice@example.com")


@pytest_asyncio.fixture
async def other_user(db_session) -> User:
    return await make_user(db_session, username="bob", email="bob@example.com")


@pytest_asyncio.fixture
async def admin_user(db_session) -> User:
    # Matches ADMIN_USER_EMAILS in the root conftest env block.
    return await make_user(db_session, username="admin", email="admin@example.com")


def authenticate(http_client: AsyncClient, user: User) -> AsyncClient:
    """Attach a genuine JWT for `user` to every subsequent request.

    Minting a real token rather than overriding get_current_user keeps the token
    decode, the blocklist lookup, and the user lookup inside the code path under
    test.
    """
    http_client.headers["Authorization"] = (
        f"Bearer {create_access_token(user.username)}"
    )
    return http_client


@pytest.fixture
def login_as(client):
    """Point the shared client at a given user.

    Requests within a test are sequential, so swapping the Authorization header
    is enough to act as somebody else — which is what the transfer handshake
    tests need.
    """

    def _login_as(user: User) -> AsyncClient:
        return authenticate(client, user)

    return _login_as


@pytest_asyncio.fixture
async def auth_client(client, user) -> AsyncClient:
    return authenticate(client, user)


@pytest_asyncio.fixture
async def admin_client(client, admin_user) -> AsyncClient:
    return authenticate(client, admin_user)
