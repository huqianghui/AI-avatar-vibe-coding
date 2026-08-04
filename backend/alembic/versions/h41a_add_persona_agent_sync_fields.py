"""Add AI Foundry agent sync fields to avatar_personas (persona-hcp-foundry-alignment Increment A).

Mirrors g11a_add_agent_fields_to_hcp_profile.py's columns on hcp_profiles.
Personas were previously pure catalog rows with no Foundry-agent identity at
all -- this restores parity with HcpProfile so personas can be synced to real
AI Foundry prompt agents via the already provider-agnostic
agent_sync_service.sync_agent_for_profile() (see debug session
persona-hcp-foundry-alignment.md, Increment A).

Revision ID: h41a_add_persona_agent_sync_fields
Revises: g40a_add_hcp_direct_voice_config
Create Date: 2026-08-04
"""

import sqlalchemy as sa

from alembic import op

revision = "h41a_add_persona_agent_sync_fields"
down_revision = "g40a_add_hcp_direct_voice_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(
            sa.Column("agent_id", sa.String(100), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column("agent_version", sa.String(50), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column("agent_sync_status", sa.String(20), server_default="none", nullable=False)
        )
        batch_op.add_column(
            sa.Column("agent_sync_error", sa.Text(), server_default="", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.drop_column("agent_sync_error")
        batch_op.drop_column("agent_sync_status")
        batch_op.drop_column("agent_version")
        batch_op.drop_column("agent_id")
