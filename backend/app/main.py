import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    CollectorRegistry,
    generate_latest,
    multiprocess,
)

from prometheus_fastapi_instrumentator import Instrumentator
from strawberry.fastapi import GraphQLRouter

from app.graphql.context import get_graphql_context
from app.graphql.schema import schema
from app.lib.app_logging import configure_structlog
from app.lib.toy_images import get_toy_image_public_path, get_toy_image_storage_dir
from app.lib.redis import connect_redis, disconnect_redis
from app.routers import (
    admin,
    auth,
    images,
    interests,
    profile,
    toys,
    user_messages,
    user_toys,
    users,
)
from app.middleware.access_log_middleware import AccessLogMiddleware

configure_structlog()


def _make_metrics_registry() -> CollectorRegistry:
    """Return an aggregating registry in multi-process mode, or the default
    registry when running as a single process (e.g. local dev)."""
    if "PROMETHEUS_MULTIPROC_DIR" in os.environ:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return registry
    return REGISTRY


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_redis()
    yield
    await disconnect_redis()


app = FastAPI(title="Toy Library API", lifespan=lifespan)

toy_image_storage_dir = get_toy_image_storage_dir()
toy_image_storage_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    get_toy_image_public_path(),
    StaticFiles(directory=str(toy_image_storage_dir)),
    name="toy-images",
)

Instrumentator().instrument(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:81",
        "http://127.0.0.1:5173",
        # "http://127.0.0.1:81",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AccessLogMiddleware)


app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(toys.router, prefix="/api/toys", tags=["toys"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(interests.router, prefix="/api/interests", tags=["interests"])

app.include_router(user_toys.router, prefix="/api/user-toys", tags=["user-toys"])
app.include_router(
    user_messages.router, prefix="/api/user-messages", tags=["user-messages"]
)
app.include_router(users.router, prefix="/api/users", tags=["users"])
graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)
app.include_router(graphql_app, prefix="/graphql")


@app.get("/metrics", include_in_schema=True)
def metrics() -> Response:
    return Response(
        content=generate_latest(_make_metrics_registry()),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.get("/health")
async def health():
    return "Hello World!"
