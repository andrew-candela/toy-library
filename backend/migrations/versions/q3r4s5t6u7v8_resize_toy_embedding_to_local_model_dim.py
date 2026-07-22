"""resize toy embedding column to local model dimension

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-07-20 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None

OLD_DIM = 1536
NEW_DIM = 768


def upgrade() -> None:
    op.drop_index("ix_toys_embedding_hnsw", table_name="toys")
    # Existing vectors were produced by the old (1536-dim) model and cannot be
    # cast to the new dimension, so they must be cleared before resizing.
    op.execute("UPDATE toys SET embedding = NULL;")
    op.alter_column(
        "toys",
        "embedding",
        type_=Vector(NEW_DIM),
        existing_type=Vector(OLD_DIM),
        existing_nullable=True,
    )
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
    op.execute("UPDATE toys SET embedding = NULL;")
    op.alter_column(
        "toys",
        "embedding",
        type_=Vector(OLD_DIM),
        existing_type=Vector(NEW_DIM),
        existing_nullable=True,
    )
    op.create_index(
        "ix_toys_embedding_hnsw",
        "toys",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
