"""Add user_preferences table (Phase 33, PERS-03).

Revision ID: d37a_user_preference_table
Revises: d37a_personalized_avatar_session
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "d37a_user_preference_table"
down_revision = "d37a_personalized_avatar_session"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_user_preferences_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_preferences_user_id"))
    op.drop_table("user_preferences")
