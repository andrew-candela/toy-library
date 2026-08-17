"""make user_toys an ownership ledger and index its foreign keys

Revision ID: r5s6t7u8v9w0
Revises: q3r4s5t6u7v8
Create Date: 2026-08-17 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r5s6t7u8v9w0"
down_revision: Union[str, None] = "q3r4s5t6u7v8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_toys",
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Existing rows all backfill to 'created': past transfers survive only as
    # log lines, so there is nothing to reconstruct them from.
    op.add_column(
        "user_toys",
        sa.Column(
            "source", sa.String(), nullable=False, server_default=sa.text("'created'")
        ),
    )

    # The one-holder-per-toy invariant moves from a constraint to a partial
    # index, so closed rows can pile up behind the open one.
    op.drop_constraint("uq_user_toys_toy_id", "user_toys", type_="unique")
    op.create_index(
        "uq_user_toys_active",
        "user_toys",
        ["toy_id"],
        unique=True,
        postgresql_where=sa.text("released_at IS NULL"),
    )

    # Redundant with the primary key. The stale name is not a typo: the index
    # was created as ix_user_items_id and survived the table rename, since
    # Postgres renames tables but not their indexes.
    op.drop_index("ix_user_items_id", table_name="user_toys")

    # The two unindexed foreign keys, scoped so archive rows never enter the
    # index — its size is then fixed by the number of toys, not by history.
    op.create_index(
        "ix_user_toys_active_user",
        "user_toys",
        ["user_id"],
        postgresql_where=sa.text("released_at IS NULL"),
    )
    op.create_index(
        "ix_user_toys_active_pending",
        "user_toys",
        ["pending_user_id"],
        postgresql_where=sa.text("released_at IS NULL AND pending_user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_user_toys_active_pending", table_name="user_toys")
    op.drop_index("ix_user_toys_active_user", table_name="user_toys")
    op.create_index("ix_user_items_id", "user_toys", ["id"], unique=False)
    op.drop_index("uq_user_toys_active", table_name="user_toys")

    # The unique constraint below cannot coexist with history, so the archive
    # rows have to go. Only the current holder of each toy is recoverable.
    op.execute("DELETE FROM user_toys WHERE released_at IS NOT NULL")
    op.create_unique_constraint("uq_user_toys_toy_id", "user_toys", ["toy_id"])

    op.drop_column("user_toys", "source")
    op.drop_column("user_toys", "released_at")
