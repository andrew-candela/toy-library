"""replace toy age_range with min_age and max_age

Revision ID: o1p2q3r4s5t6
Revises: n0o1p2q3r4s5
Create Date: 2026-07-03 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "o1p2q3r4s5t6"
down_revision = "n0o1p2q3r4s5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("toys", sa.Column("min_age", sa.Integer(), nullable=True))
    op.add_column("toys", sa.Column("max_age", sa.Integer(), nullable=True))
    op.drop_column("toys", "age_range")


def downgrade() -> None:
    op.add_column("toys", sa.Column("age_range", sa.String(), nullable=True))
    op.drop_column("toys", "max_age")
    op.drop_column("toys", "min_age")
