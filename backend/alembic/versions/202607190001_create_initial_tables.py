"""create initial tables

Revision ID: 202607190001
Revises:
Create Date: 2026-07-19 19:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202607190001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = sa.Enum("USER", "ADMIN", name="user_role")
submission_status = sa.Enum(
    "PENDING",
    "APPROVED",
    "REJECTED",
    name="submission_status",
)
point_transaction_type = sa.Enum(
    "EARN",
    "USE",
    "CANCEL",
    name="point_transaction_type",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        user_role.create(bind, checkfirst=True)
        submission_status.create(bind, checkfirst=True)
        point_transaction_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("student_number", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_student_number", "users", ["student_number"], unique=True)

    op.create_table(
        "disposal_locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("allowed_radius_m", sa.Integer(), nullable=False),
        sa.Column("qr_token", sa.String(length=36), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_disposal_locations_qr_token",
        "disposal_locations",
        ["qr_token"],
        unique=True,
    )
    op.create_index(
        "ix_disposal_locations_is_active",
        "disposal_locations",
        ["is_active"],
        unique=False,
    )

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("accuracy_m", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column("distance_m", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("status", submission_status, nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["location_id"], ["disposal_locations.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_submissions_user_status_submitted_at",
        "submissions",
        ["user_id", "status", "submitted_at"],
        unique=False,
    )
    op.create_index(
        "ix_submissions_location_status",
        "submissions",
        ["location_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_submissions_submitted_at",
        "submissions",
        ["submitted_at"],
        unique=False,
    )

    op.create_table(
        "point_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("transaction_type", point_transaction_type, nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint(
            "submission_id",
            "transaction_type",
            name="uq_point_transactions_submission_transaction_type",
        ),
    )
    op.create_index(
        "ix_point_transactions_user_created_at",
        "point_transactions",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_point_transactions_user_created_at",
        table_name="point_transactions",
    )
    op.drop_table("point_transactions")
    op.drop_index("ix_submissions_submitted_at", table_name="submissions")
    op.drop_index("ix_submissions_location_status", table_name="submissions")
    op.drop_index(
        "ix_submissions_user_status_submitted_at",
        table_name="submissions",
    )
    op.drop_table("submissions")
    op.drop_index("ix_disposal_locations_is_active", table_name="disposal_locations")
    op.drop_index("ix_disposal_locations_qr_token", table_name="disposal_locations")
    op.drop_table("disposal_locations")
    op.drop_index("ix_users_student_number", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        point_transaction_type.drop(bind, checkfirst=True)
        submission_status.drop(bind, checkfirst=True)
        user_role.drop(bind, checkfirst=True)

