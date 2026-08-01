"""Add personalized_avatar_sessions table + avatar_interaction_logs user_id/
personalized_session_id columns (Phase 33, PERS-02, D-15).

Revision ID: d37a_personalized_avatar_session
Revises: d37a_add_crm_import_log_table
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "d37a_personalized_avatar_session"
down_revision = "d37a_add_crm_import_log_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personalized_avatar_sessions",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False),
        sa.Column("last_response_id", sa.String(length=200), nullable=False),
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
    with op.batch_alter_table("personalized_avatar_sessions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_personalized_avatar_sessions_user_id"), ["user_id"], unique=False
        )

    op.add_column(
        "avatar_interaction_logs", sa.Column("user_id", sa.String(length=36), nullable=True)
    )
    op.add_column(
        "avatar_interaction_logs",
        sa.Column("personalized_session_id", sa.String(length=36), nullable=True),
    )
    with op.batch_alter_table("avatar_interaction_logs", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_avatar_interaction_logs_user_id"), ["user_id"])
        batch_op.create_index(
            batch_op.f("ix_avatar_interaction_logs_personalized_session_id"),
            ["personalized_session_id"],
        )
        batch_op.create_foreign_key(
            "fk_avatar_interaction_logs_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_avatar_interaction_logs_personalized_session_id",
            "personalized_avatar_sessions",
            ["personalized_session_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("avatar_interaction_logs", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_avatar_interaction_logs_personalized_session_id", type_="foreignkey"
        )
        batch_op.drop_constraint("fk_avatar_interaction_logs_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_avatar_interaction_logs_personalized_session_id"))
        batch_op.drop_index(batch_op.f("ix_avatar_interaction_logs_user_id"))
        batch_op.drop_column("personalized_session_id")
        batch_op.drop_column("user_id")

    with op.batch_alter_table("personalized_avatar_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_personalized_avatar_sessions_user_id"))
    op.drop_table("personalized_avatar_sessions")
