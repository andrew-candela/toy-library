import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    and_,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
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


class ToyCondition(str, enum.Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    fair = "fair"
    poor = "poor"


class Toy(Base):
    __tablename__ = "toys"
    __table_args__ = (
        # Only live rows: the index stays the size of the catalog no matter how
        # much has been delisted.
        Index(
            "ix_toys_not_deleted",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    min_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    image_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    condition: Mapped[Optional[ToyCondition]] = mapped_column(
        Enum(ToyCondition), nullable=True
    )
    date_added: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Delisting is a soft delete: the row stays so the custody ledger below keeps
    # something to point at. Every read path has to say `deleted_at IS NULL`.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tags: Mapped[list["ToyTag"]] = relationship(
        "ToyTag",
        back_populates="toy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    # user_toys is a custody ledger, so a toy that has changed hands has one row
    # per holder. The primaryjoin keeps this single-object shape honest by
    # restricting it to the row nobody has released yet.
    user_toy: Mapped[Optional["UserToy"]] = relationship(
        "UserToy",
        back_populates="toy",
        uselist=False,
        primaryjoin=lambda: and_(
            Toy.id == UserToy.toy_id, UserToy.released_at.is_(None)
        ),
    )
    embedding: Mapped[Optional[Vector]] = mapped_column(Vector(768), nullable=True)


class ToyTag(Base):
    __tablename__ = "toy_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    toy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("toys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag: Mapped[str] = mapped_column(String, nullable=False, index=True)

    toy: Mapped["Toy"] = relationship("Toy", back_populates="tags")


class UserToySource(str, enum.Enum):
    """How a holder came by the toy. Stored as plain text, not a PG enum."""

    created = "created"
    transferred = "transferred"


class UserToy(Base):
    """Append-only custody ledger: one row per stint of ownership.

    A row with ``released_at IS NULL`` is the toy's current holder; closed rows
    are history. Every query answering "who has this toy" has to say so — the
    partial indexes below only cover open rows, so those queries also stay fast
    no matter how much history accumulates.
    """

    __tablename__ = "user_toys"
    __table_args__ = (
        # Replaces the old unique constraint on toy_id: one holder at a time,
        # but any number of closed rows behind them.
        Index(
            "uq_user_toys_active",
            "toy_id",
            unique=True,
            postgresql_where=text("released_at IS NULL"),
        ),
        Index(
            "ix_user_toys_active_user",
            "user_id",
            postgresql_where=text("released_at IS NULL"),
        ),
        Index(
            "ix_user_toys_active_pending",
            "pending_user_id",
            postgresql_where=text(
                "released_at IS NULL AND pending_user_id IS NOT NULL"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    toy_id: Mapped[int] = mapped_column(Integer, ForeignKey("toys.id"), nullable=False)
    checked_out_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    released_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=UserToySource.created.value,
        server_default=UserToySource.created.value,
    )
    pending_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    user: Mapped["User"] = relationship("User", foreign_keys="[UserToy.user_id]")
    toy: Mapped["Toy"] = relationship("Toy", back_populates="user_toy")
    pending_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys="[UserToy.pending_user_id]"
    )


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    neighborhood: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="address")


class ToyInterest(Base):
    __tablename__ = "toy_interests"
    __table_args__ = (
        UniqueConstraint("user_id", "toy_id", name="uq_toy_interests_user_toy"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    toy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("toys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    user: Mapped["User"] = relationship("User")
    toy: Mapped["Toy"] = relationship("Toy")
