"""Add HCP direct voice-mode config columns + backfill from linked instances (VMODE-01).

Reverses the D-09 migration (`z33a_drop_hcp_inline_voice_fields`) that dropped
inline voice/avatar columns from `hcp_profiles` in favor of a mandatory
`VoiceLiveInstance` FK. Per the 2026-08-04 user rescope decision, HCP voice-mode
config now mirrors the AI Foundry portal's direct-config style: model
deployment, speech-output voice, avatar character/style/enabled, and
recognition language live directly on `HcpProfile` again. The `voice_live_instance_id`
FK is retained (not dropped) but becomes vestigial -- `resolve_voice_config()`
stops reading it (see Plan 38-01 Task 2).

Only 6 columns are restored (not the full 14 dropped by z33a) -- this phase
scopes to model + language + speech-output-voice + avatar-toggle +
avatar-gallery only, per CONTEXT.md. The remaining VoiceLiveInstance-only
fields (voice_type, avatar_customized, voice_temperature, turn-detection
knobs, etc.) stay hardcoded server-side in resolve_voice_config().

Existing HCP profiles that had a VoiceLiveInstance assigned are backfilled
with that instance's equivalent values via a raw UPDATE -- no silent reset
to hardcoded defaults for previously-configured profiles.

Revision ID: g40a_add_hcp_direct_voice_config
Revises: f39a_persona_greeting_map_unique_default
Create Date: 2026-08-04
"""

import sqlalchemy as sa

from alembic import op

revision = "g40a_add_hcp_direct_voice_config"
down_revision = "f39a_persona_greeting_map_unique_default"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: add the 6 direct voice-mode columns (batch mode -- SQLite Gotcha #1).
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("voice_live_model", sa.String(50), nullable=False, server_default="gpt-4o")
        )
        batch_op.add_column(
            sa.Column(
                "voice_name", sa.String(200), nullable=False, server_default="en-US-AvaNeural"
            )
        )
        batch_op.add_column(
            sa.Column("recognition_language", sa.String(20), nullable=False, server_default="auto")
        )
        batch_op.add_column(
            sa.Column("avatar_character", sa.String(100), nullable=False, server_default="lisa")
        )
        batch_op.add_column(
            sa.Column("avatar_style", sa.String(100), nullable=False, server_default="casual")
        )
        batch_op.add_column(
            sa.Column("avatar_enabled", sa.Boolean(), nullable=False, server_default=sa.true())
        )

    # Step 2: backfill from any currently-linked VoiceLiveInstance (raw SQL,
    # correlated subquery form -- supported by both SQLite and PostgreSQL, and
    # not batch-mode-scoped since it runs after the batch block closes).
    op.execute(
        """
        UPDATE hcp_profiles SET
          voice_live_model = (
            SELECT voice_live_model FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          ),
          voice_name = (
            SELECT voice_name FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          ),
          avatar_character = (
            SELECT avatar_character FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          ),
          avatar_style = (
            SELECT avatar_style FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          ),
          avatar_enabled = (
            SELECT avatar_enabled FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          ),
          recognition_language = (
            SELECT recognition_language FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          )
        WHERE voice_live_instance_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM voice_live_instances
            WHERE voice_live_instances.id = hcp_profiles.voice_live_instance_id
          )
        """
    )


def downgrade() -> None:
    # NOTE: drops columns with their per-row data discarded -- matches the
    # precedent set by z33a's own downgrade docstring (accepted risk).
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("voice_live_model")
        batch_op.drop_column("voice_name")
        batch_op.drop_column("recognition_language")
        batch_op.drop_column("avatar_character")
        batch_op.drop_column("avatar_style")
        batch_op.drop_column("avatar_enabled")
