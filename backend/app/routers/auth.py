import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth import (
    BLOCKLIST,
    SECRET_KEY,
    ALGORITHM,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.email import send_verification_email
from app.models import User
from app.schemas import Token, UserCreate, UserLogin, UserOut, VerifyEmailResponse, ResendVerificationRequest

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)) -> User:
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    token = str(uuid.uuid4())
    expires = datetime.now(tz=timezone.utc) + timedelta(hours=24)
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_email_verified=False,
        verification_token=token,
        verification_token_expires=expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    send_verification_email(user.email, token)
    return user


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )
    access_token = create_access_token(subject=user.username)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/verify-email", response_model=VerifyEmailResponse)
def verify_email(token: str = Query(...), db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token.",
        )
    expires = user.verification_token_expires
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or datetime.now(tz=timezone.utc) > expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one.",
        )
    user.is_email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification", response_model=VerifyEmailResponse)
def resend_verification(
    body: ResendVerificationRequest, db: Session = Depends(get_db)
) -> dict:
    # Always return the same response to avoid leaking whether an email is registered.
    generic = {"message": "If that email is registered and unverified, a new link has been sent."}
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.is_email_verified:
        return generic
    token = str(uuid.uuid4())
    user.verification_token = token
    user.verification_token_expires = datetime.now(tz=timezone.utc) + timedelta(hours=24)
    db.commit()
    send_verification_email(user.email, token)
    return generic


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti: str | None = payload.get("jti")
        if jti:
            BLOCKLIST.add(jti)
    except JWTError:
        pass  # token already invalid; logout is idempotent
    return {"message": "Logged out"}
