"""add allowlist table

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-05-02 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "k2l3m4n5o6p7"
down_revision: str | None = "j1k2l3m4n5o6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "allowlist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_allowlist_id"), "allowlist", ["id"], unique=False)
    op.create_index(op.f("ix_allowlist_email"), "allowlist", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_allowlist_email"), table_name="allowlist")
    op.drop_index(op.f("ix_allowlist_id"), table_name="allowlist")
    op.drop_table("allowlist")
