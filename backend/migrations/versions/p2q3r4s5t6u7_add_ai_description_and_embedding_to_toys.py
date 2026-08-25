"""add ai_description and embedding to toys

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-07-04 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "p2q3r4s5t6u7"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.add_column("toys", sa.Column("ai_description", sa.String(), nullable=True))
    op.add_column("toys", sa.Column("embedding", Vector(1536), nullable=True))
    op.create_index(
        "ix_toys_embedding_hnsw",
        "toys",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_toys_embedding_hnsw", table_name="toys")
    op.drop_column("toys", "embedding")
    op.drop_column("toys", "ai_description")
    op.execute("DROP EXTENSION IF EXISTS vector;")
