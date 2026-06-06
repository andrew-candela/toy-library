"""remove items promote toy to instance

Revision ID: l3m4n5o6p7q8
Revises: k2l3m4n5o6p7
Create Date: 2026-06-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l3m4n5o6p7q8"
down_revision: Union[str, None] = "k2l3m4n5o6p7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create toycondition enum type
    op.execute(
        "CREATE TYPE toycondition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor')"
    )

    # 2. Add condition and date_added to toys
    op.add_column(
        "toys",
        sa.Column(
            "condition",
            sa.Enum(
                "new",
                "like_new",
                "good",
                "fair",
                "poor",
                name="toycondition",
                create_type=False,
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "toys",
        sa.Column("date_added", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. Data-migrate: copy condition/date_added from the most recent item per toy
    op.execute("""
        UPDATE toys t
        SET condition = i.condition::text::toycondition,
            date_added = i.date_added
        FROM items i
        WHERE i.toy_id = t.id
          AND i.id = (
            SELECT id FROM items WHERE toy_id = t.id ORDER BY date_added DESC LIMIT 1
          )
    """)

    # 4. Add toy_id to user_items, migrate data, then finalize and rename table
    op.add_column("user_items", sa.Column("toy_id", sa.Integer(), nullable=True))
    op.execute("""
        UPDATE user_items ui
        SET toy_id = i.toy_id
        FROM items i
        WHERE i.id = ui.item_id
    """)
    op.alter_column("user_items", "toy_id", nullable=False)
    op.drop_constraint("uq_user_items_item_id", "user_items", type_="unique")
    op.drop_constraint("user_items_item_id_fkey", "user_items", type_="foreignkey")
    op.drop_column("user_items", "item_id")
    op.create_unique_constraint("uq_user_toys_toy_id", "user_items", ["toy_id"])
    op.create_foreign_key(
        "user_toys_toy_id_fkey", "user_items", "toys", ["toy_id"], ["id"]
    )
    op.rename_table("user_items", "user_toys")

    # 5. Add toy_id to item_interests, migrate data, then finalize and rename table
    op.add_column("item_interests", sa.Column("toy_id", sa.Integer(), nullable=True))
    op.execute("""
        UPDATE item_interests ii
        SET toy_id = i.toy_id
        FROM items i
        WHERE i.id = ii.item_id
    """)
    op.alter_column("item_interests", "toy_id", nullable=False)
    op.drop_constraint("uq_item_interests_user_item", "item_interests", type_="unique")
    op.drop_constraint(
        "item_interests_item_id_fkey", "item_interests", type_="foreignkey"
    )
    op.drop_column("item_interests", "item_id")
    op.create_unique_constraint(
        "uq_toy_interests_user_toy", "item_interests", ["user_id", "toy_id"]
    )
    op.create_foreign_key(
        "toy_interests_toy_id_fkey",
        "item_interests",
        "toys",
        ["toy_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.rename_table("item_interests", "toy_interests")

    # 6. Drop items table (FKs from user_toys/toy_interests to items are already gone)
    op.drop_table("items")

    # 7. Drop old itemcondition enum type
    op.execute("DROP TYPE itemcondition")


def downgrade() -> None:
    # 1. Recreate itemcondition enum
    op.execute(
        "CREATE TYPE itemcondition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor')"
    )

    # 2. Recreate items table (data cannot be restored)
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("toy_id", sa.Integer(), nullable=False),
        sa.Column(
            "condition",
            sa.Enum(
                "new",
                "like_new",
                "good",
                "fair",
                "poor",
                name="itemcondition",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("date_added", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["toy_id"], ["toys.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Rename toy_interests → item_interests and restore item_id
    op.rename_table("toy_interests", "item_interests")
    op.drop_constraint(
        "toy_interests_toy_id_fkey", "item_interests", type_="foreignkey"
    )
    op.drop_constraint("uq_toy_interests_user_toy", "item_interests", type_="unique")
    op.add_column("item_interests", sa.Column("item_id", sa.Integer(), nullable=True))
    op.drop_column("item_interests", "toy_id")
    op.create_unique_constraint(
        "uq_item_interests_user_item", "item_interests", ["user_id", "item_id"]
    )

    # 4. Rename user_toys → user_items and restore item_id
    op.rename_table("user_toys", "user_items")
    op.drop_constraint("user_toys_toy_id_fkey", "user_items", type_="foreignkey")
    op.drop_constraint("uq_user_toys_toy_id", "user_items", type_="unique")
    op.add_column("user_items", sa.Column("item_id", sa.Integer(), nullable=True))
    op.drop_column("user_items", "toy_id")
    op.create_unique_constraint("uq_user_items_item_id", "user_items", ["item_id"])

    # 5. Drop condition and date_added from toys
    op.drop_column("toys", "condition")
    op.drop_column("toys", "date_added")

    # 6. Drop toycondition enum
    op.execute("DROP TYPE toycondition")
