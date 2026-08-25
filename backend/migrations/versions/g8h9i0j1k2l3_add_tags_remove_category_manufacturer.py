"""add tags remove category manufacturer

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-04-25 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "g8h9i0j1k2l3"
down_revision: str | None = "f7a8b9c0d1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("toys", "category")
    op.drop_column("toys", "manufacturer")
    op.create_table(
        "toy_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("toy_id", sa.Integer(), nullable=False),
        sa.Column("tag", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["toy_id"], ["toys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_toy_tags_toy_id", "toy_tags", ["toy_id"])
    op.create_index("ix_toy_tags_tag", "toy_tags", ["tag"])


def downgrade() -> None:
    op.drop_index("ix_toy_tags_tag", table_name="toy_tags")
    op.drop_index("ix_toy_tags_toy_id", table_name="toy_tags")
    op.drop_table("toy_tags")
    op.add_column("toys", sa.Column("manufacturer", sa.String(), nullable=True))
    op.add_column(
        "toys",
        sa.Column("category", sa.String(), nullable=False, server_default=""),
    )
