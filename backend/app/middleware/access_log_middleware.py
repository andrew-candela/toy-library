import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.lib.app_logging import structlog

logger = structlog.get_logger(__name__)


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = time.perf_counter() - start_time

        client_ip = request.headers.get(
            "x-forwarded-for", request.client.host if request.client else ""
        )

        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=response.status_code,
            duration_ms=duration_ms * 1000,
        )

        return response
