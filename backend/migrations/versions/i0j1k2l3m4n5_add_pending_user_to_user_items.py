"""add pending user to user items

Revision ID: i0j1k2l3m4n5
Revises: h9i0j1k2l3m4
Create Date: 2026-04-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "i0j1k2l3m4n5"
down_revision: str | None = "h9i0j1k2l3m4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_items",
        sa.Column("pending_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_user_items_pending_user_id",
        "user_items",
        "users",
        ["pending_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_user_items_pending_user_id", "user_items", type_="foreignkey"
    )
    op.drop_column("user_items", "pending_user_id")
