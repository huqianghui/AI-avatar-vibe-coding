"""Add user_crm_contexts table (Phase 33, PERS-01).

Revision ID: c36a_personalization_crm_tables
Revises: b35a_add_anonymous_avatar_tables
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "c36a_personalization_crm_tables"
down_revision = "b35a_add_anonymous_avatar_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_crm_contexts",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("customer_name", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
        sa.Column("crm_notes", sa.Text(), nullable=False),
        sa.Column("contact_person", sa.String(length=200), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("user_crm_contexts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_user_crm_contexts_user_id"), ["user_id"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("user_crm_contexts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_crm_contexts_user_id"))
    op.drop_table("user_crm_contexts")
