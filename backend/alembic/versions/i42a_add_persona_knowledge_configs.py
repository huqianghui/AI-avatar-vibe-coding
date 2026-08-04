"""Add avatar_persona_knowledge_configs table (persona-hcp-foundry-alignment
Increment C).

Sibling table to hcp_knowledge_configs (p19a_add_hcp_knowledge_configs.py) --
not a shared polymorphic FK, since HcpKnowledgeConfig.hcp_profile_id is a
hard-typed, NOT-NULL FK to hcp_profiles.id.

Revision ID: i42a_add_persona_knowledge_configs
Revises: h41a_add_persona_agent_sync_fields
Create Date: 2026-08-04
"""

import sqlalchemy as sa

from alembic import op

revision = "i42a_add_persona_knowledge_configs"
down_revision = "h41a_add_persona_agent_sync_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "avatar_persona_knowledge_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "avatar_persona_id",
            sa.String(36),
            sa.ForeignKey("avatar_personas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("connection_name", sa.String(255), nullable=False),
        sa.Column("connection_target", sa.String(500), server_default="", nullable=False),
        sa.Column("index_name", sa.String(255), nullable=False),
        sa.Column("server_label", sa.String(255), server_default="", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("avatar_persona_knowledge_configs")
