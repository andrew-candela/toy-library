"""soft delete toys so the ownership ledger survives delisting

Revision ID: s6t7u8v9w0x1
Revises: r5s6t7u8v9w0
Create Date: 2026-08-18 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s6t7u8v9w0x1"
down_revision: Union[str, None] = "r5s6t7u8v9w0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "toys",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Every read path filters on this, so the index only covers live rows —
    # its size is then fixed by the catalog, not by how much has been delisted.
    op.create_index(
        "ix_toys_not_deleted",
        "toys",
        ["id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_toys_not_deleted", table_name="toys")
    op.drop_column("toys", "deleted_at")
