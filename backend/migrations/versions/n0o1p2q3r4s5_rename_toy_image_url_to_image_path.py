"""rename toy image url to image path

Revision ID: n0o1p2q3r4s5
Revises: m4n5o6p7q8r9
Create Date: 2026-06-17 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "n0o1p2q3r4s5"
down_revision = "m4n5o6p7q8r9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("toys", "image_url", new_column_name="image_path")


def downgrade() -> None:
    op.alter_column("toys", "image_path", new_column_name="image_url")
