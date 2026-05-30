import os
import time
from typing import Annotated
from fastapi import HTTPException, status, Request, Depends
from app.lib.redis import get_redis_client
from redis.asyncio import Redis


_RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
_RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "10"))


async def rate_limit_request(
    request: Request, redis_client: Annotated[Redis, Depends(get_redis_client)]
):
    """
    Limits requests to the configured rate.
    """
    user_id = request.client.host if request.client is not None else "unknown"
    key = f"rate_limit:{user_id}"
    now = time.time()
    async with redis_client.pipeline(transaction=True) as pipe:
        # Removes old requests
        pipe.zremrangebyscore(key, 0, now - _RATE_LIMIT_WINDOW)
        # Adds the new request
        pipe.zadd(key, {str(now): now})
        # Count total requests in window
        pipe.zcard(key)
        # Set expiration on the key
        pipe.expire(key, _RATE_LIMIT_WINDOW)

        _, _, request_count, _ = await pipe.execute()

    if request_count >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests"
        )
