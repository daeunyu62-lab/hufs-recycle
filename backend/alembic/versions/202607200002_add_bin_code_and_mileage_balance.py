"""add bin code and mileage balance

Revision ID: 202607200002
Revises: 202607200001
Create Date: 2026-07-20 20:55:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202607200002"
down_revision: str | None = "202607200001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "mileage_balance",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )

    with op.batch_alter_table("disposal_locations") as batch_op:
        batch_op.add_column(sa.Column("code", sa.String(length=50), nullable=True))
        batch_op.add_column(
            sa.Column(
                "qr_secret_version",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )

    op.execute("UPDATE disposal_locations SET code = 'HUFS-' || id WHERE code IS NULL")

    with op.batch_alter_table("disposal_locations") as batch_op:
        batch_op.alter_column(
            "code",
            existing_type=sa.String(length=50),
            nullable=False,
        )
        batch_op.create_index("ix_disposal_locations_code", ["code"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("disposal_locations") as batch_op:
        batch_op.drop_index("ix_disposal_locations_code")
        batch_op.drop_column("qr_secret_version")
        batch_op.drop_column("code")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("mileage_balance")
