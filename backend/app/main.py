from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.logging_config import configure_logging
from app.auth import get_current_user
from app.models import User
from app.routers import auth

configure_logging()

app = FastAPI(title="Toy Library API")

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

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/api/items")
def get_items(current_user: User = Depends(get_current_user)) -> list[dict]:
    return []
