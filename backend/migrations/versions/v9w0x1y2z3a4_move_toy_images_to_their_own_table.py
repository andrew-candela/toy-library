"""move toy images to their own table so a toy can have up to three

A toy carried exactly one photo in `toys.image_path`. `toy_images` makes that a
list: up to three rows per toy, each either an upload we store (`path`) or an
external link the browser loads directly (`external_url`). `position` orders
them, and position 0 is the cover — the only image list views render and the
only one the AI description is generated from.

The CHECK constraint is what keeps a row honest about which of the two sources
it is. The unique `(toy_id, position)` is what keeps the ordering a permutation
rather than a suggestion; it is also why the endpoints rewrite positions in two
passes rather than in place.

Revision ID: v9w0x1y2z3a4
Revises: u8v9w0x1y2z3
Create Date: 2026-10-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "v9w0x1y2z3a4"
down_revision: str | None = "u8v9w0x1y2z3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "toy_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("toy_id", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("external_url", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["toy_id"], ["toys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(path IS NOT NULL AND external_url IS NULL)"
            " OR (path IS NULL AND external_url IS NOT NULL)",
            name="ck_toy_images_exactly_one_source",
        ),
        sa.UniqueConstraint("toy_id", "position", name="uq_toy_images_toy_position"),
    )
    op.create_index("ix_toy_images_id", "toy_images", ["id"])
    op.create_index("ix_toy_images_toy_id", "toy_images", ["toy_id"])

    # Every existing photo becomes that toy's cover, so nothing visibly changes
    # for a toy that already had one.
    op.execute(
        sa.text(
            "INSERT INTO toy_images (toy_id, path, position, created_at) "
            "SELECT id, image_path, 0, now() FROM toys WHERE image_path IS NOT NULL"
        )
    )

    op.drop_column("toys", "image_path")


def downgrade() -> None:
    op.add_column("toys", sa.Column("image_path", sa.String(), nullable=True))
    # Only the cover can come back, and only when it is an upload: the old column
    # had nowhere to put a second photo and nothing that served an external link.
    op.execute(
        sa.text(
            "UPDATE toys SET image_path = toy_images.path "
            "FROM toy_images "
            "WHERE toy_images.toy_id = toys.id "
            "AND toy_images.position = 0 "
            "AND toy_images.path IS NOT NULL"
        )
    )
    op.drop_index("ix_toy_images_toy_id", table_name="toy_images")
    op.drop_index("ix_toy_images_id", table_name="toy_images")
    op.drop_table("toy_images")
