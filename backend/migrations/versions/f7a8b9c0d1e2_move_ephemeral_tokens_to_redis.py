"""move ephemeral tokens to redis

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-04-25 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "verification_token")
    op.drop_column("users", "verification_token_expires")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "password_reset_token_expires")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_token_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("password_reset_token", sa.String(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("verification_token_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("verification_token", sa.String(), nullable=True),
    )
