import logging
import os
from collections.abc import Awaitable
from typing import cast

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

_redis: aioredis.Redis | None = None


async def connect_redis() -> None:
    global _redis
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    await cast(Awaitable[bool], _redis.ping())
    logger.info("Redis connection pool established: %s", REDIS_URL)


async def disconnect_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection pool closed")


def get_redis_client() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError(
            "Redis client is not initialised. "
            "Ensure connect_redis() has been called during application startup."
        )
    return _redis
