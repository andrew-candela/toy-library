"""index toys for the expiry filter

t7u8v9w0x1y2 added `last_owner_activity_at` without an index, on the grounds
that the useful shape depended on a filter predicate that did not exist yet. It
exists now, in app/lib/toy_expiration.py, and every catalog read evaluates it:

    NOT EXISTS (SELECT 1 FROM toy_interests WHERE toy_id = toys.id)
    AND (last_owner_activity_at IS NULL OR last_owner_activity_at < :cutoff)

The EXISTS half is already served by ix_toy_interests_toy_id. This covers the
other half. Partial on `deleted_at IS NULL` to match ix_toys_not_deleted: the
predicate only ever runs alongside that filter, so delisted rows would be dead
weight in the index.

Nulls are included deliberately — the predicate treats a null
`last_owner_activity_at` as expired, so those rows are matches, not misses.

Revision ID: u8v9w0x1y2z3
Revises: t7u8v9w0x1y2
Create Date: 2026-08-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "u8v9w0x1y2z3"
down_revision: str | None = "t7u8v9w0x1y2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_toys_active_owner_activity",
        "toys",
        ["last_owner_activity_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_toys_active_owner_activity", table_name="toys")
