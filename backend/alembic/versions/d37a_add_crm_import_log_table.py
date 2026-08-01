"""Add crm_import_logs table (Phase 33, PERS-01/D-12).

Revision ID: d37a_add_crm_import_log_table
Revises: c36a_personalization_crm_tables
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "d37a_add_crm_import_log_table"
down_revision = "c36a_personalization_crm_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_import_logs",
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("success_count", sa.Integer(), nullable=False),
        sa.Column("skipped", sa.Text(), nullable=False),
        sa.Column("unmatched", sa.Text(), nullable=False),
        sa.Column("imported_by", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("crm_import_logs")
