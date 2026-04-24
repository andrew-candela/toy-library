"""add item interests table

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
Create Date: 2026-04-30 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j1k2l3m4n5o6"
down_revision: Union[str, None] = "i0j1k2l3m4n5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "item_interests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_id", name="uq_item_interests_user_item"),
    )
    op.create_index(
        op.f("ix_item_interests_id"), "item_interests", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_item_interests_item_id"), "item_interests", ["item_id"], unique=False
    )
    op.create_index(
        op.f("ix_item_interests_user_id"), "item_interests", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_item_interests_user_id"), table_name="item_interests")
    op.drop_index(op.f("ix_item_interests_item_id"), table_name="item_interests")
    op.drop_index(op.f("ix_item_interests_id"), table_name="item_interests")
    op.drop_table("item_interests")
