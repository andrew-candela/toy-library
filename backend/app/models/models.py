import enum
from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
        # Serves the staleness half of the expiry predicate in
        # app/lib/toy_expiration.py. Partial on the same condition as the index
        # above, since expiry is only ever evaluated on live rows.
        Index(
            "ix_toys_active_owner_activity",
            "last_owner_activity_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    min_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_description: Mapped[str | None] = mapped_column(String, nullable=True)
    condition: Mapped[ToyCondition | None] = mapped_column(
        Enum(ToyCondition), nullable=True
    )
    date_added: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Delisting is a soft delete: the row stays so the custody ledger below keeps
    # something to point at. Every read path has to say `deleted_at IS NULL`.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Denormalized rather than derived from `max(toy_interests.created_at)`:
    # interests are hard-deleted, so that maximum drops the moment anyone
    # withdraws and the signal is gone. Withdrawing does not clear this — the
    # interest was genuinely shown at the time.
    last_interest_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Kept apart from last_interest_at because "the owner is still tending this
    # listing" and "somebody else still wants it" are different signals. This is
    # the one the expiry clock in app/lib/toy_expiration.py runs on; interest is
    # read live from toy_interests there rather than from last_interest_at.
    last_owner_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tags: Mapped[list["ToyTag"]] = relationship(
        "ToyTag",
        back_populates="toy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    # Ordered by position, so `images[0]` is the cover everywhere — the only one
    # list views render and the only one the AI description is generated from.
    images: Mapped[list["ToyImage"]] = relationship(
        "ToyImage",
        back_populates="toy",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by=lambda: ToyImage.position,
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
    embedding: Mapped[Vector | None] = mapped_column(Vector(768), nullable=True)


class ToyTag(Base):
    __tablename__ = "toy_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    toy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("toys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag: Mapped[str] = mapped_column(String, nullable=False, index=True)

    toy: Mapped["Toy"] = relationship("Toy", back_populates="tags")


class ToyImage(Base):
    """One photo on a toy: either an upload we store, or a link we only point at.

    `path` and `external_url` are the two mutually exclusive sources, kept apart
    rather than collapsed into one column because they are served completely
    differently — an upload goes through the authenticated image endpoint, a link
    is hotlinked by the browser and never fetched by us. The CHECK constraint is
    what stops a row from claiming to be both or neither.
    """

    __tablename__ = "toy_images"
    __table_args__ = (
        CheckConstraint(
            "(path IS NOT NULL AND external_url IS NULL)"
            " OR (path IS NULL AND external_url IS NOT NULL)",
            name="ck_toy_images_exactly_one_source",
        ),
        UniqueConstraint("toy_id", "position", name="uq_toy_images_toy_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    toy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("toys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str | None] = mapped_column(String, nullable=True)
    external_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # 0 is the cover. Rewritten to be contiguous from 0 on every save, so the
    # ordering never depends on the ids or on insertion order.
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    toy: Mapped["Toy"] = relationship("Toy", back_populates="images")

    @property
    def src(self) -> str:
        """What the browser loads: our own path, or the link as given."""
        return self.path or self.external_url or ""

    @property
    def is_external(self) -> bool:
        return self.external_url is not None


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
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=UserToySource.created.value,
        server_default=UserToySource.created.value,
    )
    pending_user_id: Mapped[int | None] = mapped_column(
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
    neighborhood: Mapped[str | None] = mapped_column(String, nullable=True)

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
