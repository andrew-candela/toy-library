from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from app.graphql.context import get_graphql_context
from app.graphql.schema import schema
from app.lib.logging import configure_structlog
from app.lib.redis import connect_redis, disconnect_redis
from app.routers import admin, auth, interests, profile, toys, user_toys, users
from app.middleware.access_log_middleware import AccessLogMiddleware

configure_structlog()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_redis()
    yield
    await disconnect_redis()


app = FastAPI(title="Toy Library API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
app.include_router(interests.router, prefix="/api/interests", tags=["interests"])

app.include_router(user_toys.router, prefix="/api/user-toys", tags=["user-toys"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)
app.include_router(graphql_app, prefix="/graphql")


@app.get("/health")
async def health():
    return "Hello World!"
