"""seed allowlist with admin user emails

Revision ID: m4n5o6p7q8r9
Revises: l3m4n5o6p7q8
Create Date: 2026-06-02 00:00:00.000000

"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m4n5o6p7q8r9"
down_revision: Union[str, None] = "l3m4n5o6p7q8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_admin_user_emails() -> list[str]:
    raw = os.getenv("ADMIN_USER_EMAILS", "")
    return sorted({email.strip().lower() for email in raw.split(",") if email.strip()})


def upgrade() -> None:
    bind = op.get_bind()
    admin_emails = _get_admin_user_emails()

    if not admin_emails:
        return

    insert_stmt = sa.text(
        """
        INSERT INTO allowlist (email)
        VALUES (:email)
        ON CONFLICT (email) DO NOTHING
        """
    )

    for email in admin_emails:
        bind.execute(insert_stmt, {"email": email})


def downgrade() -> None:
    bind = op.get_bind()
    admin_emails = _get_admin_user_emails()

    if not admin_emails:
        return

    delete_stmt = sa.text("DELETE FROM allowlist WHERE email = :email")

    for email in admin_emails:
        bind.execute(delete_stmt, {"email": email})
