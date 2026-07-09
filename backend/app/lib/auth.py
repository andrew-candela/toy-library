from typing import Annotated
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.database import get_db
from app.lib.redis import get_redis_client
from app.models.models import User

# WARNING: set JWT_SECRET_KEY to a strong random value in production.
# Example: openssl rand -hex 32
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300
ADMIN_USER_EMAILS = set(
    (email.lower().strip() for email in os.getenv("ADMIN_USER_EMAILS", "").split(","))
)


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

password_form_type = Annotated[OAuth2PasswordRequestForm, Depends()]

_BLOCKLIST_PREFIX = "blocklist:"

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def add_jti_to_blocklist(jti: str, ttl_seconds: int) -> None:
    """Persist a revoked JWT ID in Redis until it would have expired naturally."""
    if ttl_seconds > 0:
        await get_redis_client().setex(f"{_BLOCKLIST_PREFIX}{jti}", ttl_seconds, "1")


async def is_jti_blocked(jti: str) -> bool:
    return await get_redis_client().exists(f"{_BLOCKLIST_PREFIX}{jti}") == 1


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "jti": str(uuid.uuid4()),
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def authenticate_token(token: str, db: AsyncSession) -> User | None:
    """Return the User for a valid JWT, or None if the token is invalid/expired/blocked."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if username is None or jti is None:
            return None
    except JWTError:
        return None

    if await is_jti_blocked(jti):
        return None

    return (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await authenticate_token(token, db)
    if user is None:
        raise credentials_exception
    return user


async def get_admin_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_current_user(token, db)
    if user.email.lower() not in ADMIN_USER_EMAILS:
        raise credentials_exception
    return user
