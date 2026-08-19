"""track last interest and last owner activity on toys

Groundwork for expiring stale listings. Nothing reads these yet — the columns
exist so the filter that eventually hides quiet toys has populated history to
work against rather than starting from an empty table.

No index: the useful shape depends on the final filter predicate, which does
not exist yet.

Revision ID: t7u8v9w0x1y2
Revises: s6t7u8v9w0x1
Create Date: 2026-08-19 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t7u8v9w0x1y2"
down_revision: Union[str, None] = "s6t7u8v9w0x1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both nullable: `date_added` is itself nullable and interests are
    # hard-deleted, so neither backfill below can promise a value for every row.
    op.add_column(
        "toys",
        sa.Column("last_interest_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "toys",
        sa.Column("last_owner_activity_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Backfill from what is still on hand. `date_added` is the only owner-side
    # timestamp that survives, and it is the listing's own creation time.
    op.execute("UPDATE toys SET last_owner_activity_at = date_added")
    # Lossy by construction — withdrawn interests are already gone — but it
    # beats leaving every existing toy looking as though nobody ever asked.
    op.execute(
        """
        UPDATE toys t SET last_interest_at = (
            SELECT max(created_at) FROM toy_interests WHERE toy_id = t.id
        )
        """
    )


def downgrade() -> None:
    op.drop_column("toys", "last_owner_activity_at")
    op.drop_column("toys", "last_interest_at")
