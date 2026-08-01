"""Add anonymous avatar session, interaction log, public knowledge config tables.

Phase 32 (Anonymous Grounded Avatar Q&A) foundation: three new tables backing
the anonymous-mode avatar — server-issued session (source of truth for
expiry/quota), audit interaction log (nullable session FK with ON DELETE SET
NULL so audit rows outlive session cleanup), and admin-managed singleton
public knowledge config (agent + Foundry IQ connection + avatar/voice map).

Revision ID: b35a_add_anonymous_avatar_tables
Revises: a34a_session_agent_pin
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "b35a_add_anonymous_avatar_tables"
down_revision = "a34a_session_agent_pin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anonymous_avatar_sessions",
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False),
        sa.Column("last_response_id", sa.String(length=200), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "public_knowledge_configs",
        sa.Column("agent_id", sa.String(length=100), nullable=False),
        sa.Column("agent_version", sa.String(length=50), nullable=False),
        sa.Column("connection_name", sa.String(length=255), nullable=False),
        sa.Column("connection_target", sa.String(length=500), nullable=False),
        sa.Column("index_name", sa.String(length=255), nullable=False),
        sa.Column("avatar_character", sa.String(length=100), nullable=False),
        sa.Column("avatar_style", sa.String(length=100), nullable=False),
        sa.Column("voice_map", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "avatar_interaction_logs",
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer_summary", sa.Text(), nullable=False),
        sa.Column("citation_count", sa.Integer(), nullable=False),
        sa.Column("is_refusal", sa.Boolean(), nullable=False),
        sa.Column("response_id", sa.String(length=200), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["anonymous_avatar_sessions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("avatar_interaction_logs", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_avatar_interaction_logs_session_id"), ["session_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("avatar_interaction_logs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_avatar_interaction_logs_session_id"))

    op.drop_table("avatar_interaction_logs")
    op.drop_table("public_knowledge_configs")
    op.drop_table("anonymous_avatar_sessions")
