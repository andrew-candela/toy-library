import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://toy_library:toy_library@postgres:5432/toy_library")

# Convert postgresql:// -> postgresql+asyncpg:// for async support.
# Alembic migrations read the raw DATABASE_URL env var directly and are unaffected.
ASYNC_DATABASE_URL = _DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(ASYNC_DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
