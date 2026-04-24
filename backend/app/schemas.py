from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models import ItemCondition


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


class ToyCreate(BaseModel):
    title: str
    category: str
    description: Optional[str] = None
    age_range: Optional[str] = None
    manufacturer: Optional[str] = None
    image_url: Optional[str] = None


class ToyOut(ToyCreate):
    id: int

    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    toy_id: int
    condition: ItemCondition
    date_added: datetime


class ItemOut(ItemCreate):
    id: int
    toy: ToyOut

    model_config = {"from_attributes": True}


class UserItemCreate(BaseModel):
    user_id: int
    item_id: int
    checked_out_at: datetime


class UserItemOut(UserItemCreate):
    id: int
    user: UserOut
    item: ItemOut

    model_config = {"from_attributes": True}
