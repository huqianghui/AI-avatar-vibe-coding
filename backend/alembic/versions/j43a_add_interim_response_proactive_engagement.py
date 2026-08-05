"""Add interim response + proactive engagement config columns to hcp_profiles
and avatar_personas (persona-hcp-foundry-alignment Increment F).

Foundry-portal parity: the portal's Configuration panel exposes "Interim
response" (toggle + type + response-threshold-ms) and "Proactive engagement"
(toggle) under Speech output's Advanced settings. Adds the same 4 columns to
BOTH voice-mode-config-bearing tables, mirroring the existing pattern
(g40a_add_hcp_direct_voice_config / h41a_add_persona_agent_sync_fields) of
duplicating inline columns across the two tables rather than a shared table.

Revision ID: j43a_add_interim_response_proactive_engagement
Revises: i42a_add_persona_knowledge_configs
Create Date: 2026-08-05
"""

import sqlalchemy as sa

from alembic import op

revision = "j43a_add_interim_response_proactive_engagement"
down_revision = "i42a_add_persona_knowledge_configs"
branch_labels = None
depends_on = None

_TABLES = ("hcp_profiles", "avatar_personas")


def upgrade() -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "proactive_engagement", sa.Boolean(), server_default=sa.false(), nullable=False
                )
            )
            batch_op.add_column(
                sa.Column(
                    "interim_response_enabled",
                    sa.Boolean(),
                    server_default=sa.false(),
                    nullable=False,
                )
            )
            batch_op.add_column(
                sa.Column(
                    "interim_response_type", sa.String(20), server_default="llm", nullable=False
                )
            )
            batch_op.add_column(
                sa.Column(
                    "interim_response_threshold_ms",
                    sa.Integer(),
                    server_default="500",
                    nullable=False,
                )
            )


def downgrade() -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("interim_response_threshold_ms")
            batch_op.drop_column("interim_response_type")
            batch_op.drop_column("interim_response_enabled")
            batch_op.drop_column("proactive_engagement")
