from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, EmailStr, field_validator

from app.models.models import ItemCondition

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


class ToyOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    age_range: str | None = None
    image_url: str | None = None
    tags: list[str] = []

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


class ItemCreate(BaseModel):
    toy_id: int
    condition: ItemCondition


class ItemUpdate(BaseModel):
    toy_id: int | None = None
    condition: ItemCondition | None = None


class ItemOut(ItemCreate):
    id: int
    date_added: datetime
    toy: ToyOut

    model_config = {"from_attributes": True}


class OwnerInfo(BaseModel):
    username: str
    neighborhood: str | None = None

    model_config = {"from_attributes": True}


class ItemWithOwnerOut(ItemOut):
    owner: OwnerInfo | None = None


class UserItemCreate(BaseModel):
    user_id: int
    item_id: int
    checked_out_at: datetime


class UserItemOut(UserItemCreate):
    id: int
    user: UserOut
    item: ItemOut
    pending_user: UserOut | None = None

    model_config = {"from_attributes": True}


class TransferInitiateRequest(BaseModel):
    to_username: str


class InterestOut(BaseModel):
    id: int
    user: UserOut
    item_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


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
