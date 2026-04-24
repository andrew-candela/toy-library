import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.lib.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    address: Mapped[Optional["Address"]] = relationship(
        "Address", back_populates="user", uselist=False
    )


class AllowList(Base):
    __tablename__ = "allowlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)


class Toy(Base):
    __tablename__ = "toys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    age_range: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    tags: Mapped[list["ToyTag"]] = relationship(
        "ToyTag",
        back_populates="toy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ToyTag(Base):
    __tablename__ = "toy_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    toy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("toys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag: Mapped[str] = mapped_column(String, nullable=False, index=True)

    toy: Mapped["Toy"] = relationship("Toy", back_populates="tags")


class ItemCondition(str, enum.Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    fair = "fair"
    poor = "poor"


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    toy_id: Mapped[int] = mapped_column(Integer, ForeignKey("toys.id"), nullable=False)
    condition: Mapped[ItemCondition] = mapped_column(
        Enum(ItemCondition), nullable=False
    )
    date_added: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    toy: Mapped["Toy"] = relationship("Toy")
    user_item: Mapped[Optional["UserItem"]] = relationship(
        "UserItem", back_populates="item", uselist=False
    )


class UserItem(Base):
    __tablename__ = "user_items"
    __table_args__ = (UniqueConstraint("item_id", name="uq_user_items_item_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=False
    )
    checked_out_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    pending_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    user: Mapped["User"] = relationship("User", foreign_keys="[UserItem.user_id]")
    item: Mapped["Item"] = relationship("Item", back_populates="user_item")
    pending_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys="[UserItem.pending_user_id]"
    )


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    neighborhood: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="address")


class ItemInterest(Base):
    __tablename__ = "item_interests"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="uq_item_interests_user_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    user: Mapped["User"] = relationship("User")
    item: Mapped["Item"] = relationship("Item")
