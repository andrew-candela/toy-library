from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, EmailStr, field_validator

from app.models.models import ToyCondition

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_email_verified: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class VerifyEmailResponse(BaseModel):
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    message: str


class ToyCreate(BaseModel):
    title: str
    description: str | None = None
    age_range: str | None = None
    image_url: str | None = None
    tags: list[str] = []
    condition: ToyCondition | None = None
    date_added: datetime | None = None


class ToyOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    age_range: str | None = None
    image_url: str | None = None
    tags: list[str] = []
    condition: ToyCondition | None = None
    date_added: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("tags", mode="before")
    @classmethod
    def coerce_tags(cls, v: Any) -> list[str]:
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, str):
                result.append(item)
            else:
                result.append(item.tag)
        return result


class ToyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    age_range: str | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    condition: ToyCondition | None = None
    date_added: datetime | None = None


class UserToyCreate(BaseModel):
    user_id: int
    toy_id: int
    checked_out_at: datetime


class UserToyOut(UserToyCreate):
    id: int
    user: UserOut
    toy: ToyOut
    pending_user: UserOut | None = None

    model_config = {"from_attributes": True}


class TransferInitiateRequest(BaseModel):
    to_username: str


class InterestOut(BaseModel):
    id: int
    user: UserOut
    toy_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class InterestSummaryOut(BaseModel):
    toy_id: int
    interested_count: int
    viewer_interested: bool


class InterestDetailOut(BaseModel):
    toy_id: int
    interested_count: int
    can_view_usernames: bool
    interested_usernames: list[str] = []


class ProfileOut(BaseModel):
    id: int
    username: str
    email: str
    is_email_verified: bool
    neighborhood: str | None = None

    model_config = {"from_attributes": True}


class UpdateUsernameRequest(BaseModel):
    username: str


class UpdateUsernameResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str


class UpdateEmailRequest(BaseModel):
    email: EmailStr


class UpdateEmailResponse(BaseModel):
    message: str


class UpdateNeighborhoodRequest(BaseModel):
    neighborhood: str | None = None


class UpdateNeighborhoodResponse(BaseModel):
    neighborhood: str | None = None


class AllowListResponse(BaseModel):
    emails: list[str]


class AllowListDeleteResponse(BaseModel):
    email: str


class UserListOut(BaseModel):
    id: int
    username: str
    neighborhood: str | None = None
    toy_count: int

    model_config = {"from_attributes": True}


class UserDetailOut(BaseModel):
    id: int
    username: str
    neighborhood: str | None = None
    toy_count: int

    model_config = {"from_attributes": True}


class UserContactEmailRequest(BaseModel):
    to_username: str
    message: str

    @field_validator("to_username")
    @classmethod
    def validate_to_username(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Recipient username is required")
        return stripped

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message is required")
        if len(stripped) < 5:
            raise ValueError("Message must be at least 5 characters")
        if len(stripped) > 2000:
            raise ValueError("Message must be 2000 characters or fewer")
        return stripped


class UserContactEmailResponse(BaseModel):
    message: str
