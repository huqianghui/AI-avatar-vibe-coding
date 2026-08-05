"""Add speech-recognition-model + Speech input/output advanced-settings
config columns to hcp_profiles and avatar_personas (persona-hcp-foundry-
alignment Increment G).

Foundry-portal parity, 4 remaining gaps confirmed against the real Azure AI
Foundry portal Configuration panel:
  1. Speech recognition model (transcription model, distinct from the LLM
     "Model deployment" select) -- ``speech_recognition_model``.
  2. Language Auto-detect as a toggle (personas only; HCP already has the
     "auto" sentinel on `recognition_language`) -- ``auto_detect_language``.
  3. Speech input > Advanced settings: EOU detection, Noise suppression,
     Echo cancellation, Phrase list -- ``eou_detection``, ``noise_suppression``,
     ``echo_cancellation``, ``phrase_list``.
  4. Speech output > Advanced settings additions: Voice temperature,
     Playback speed, Custom lexicon URL -- ``voice_temperature``,
     ``playback_speed``, ``custom_lexicon_url``.

Mirrors the existing pattern (g40a/h41a/j43a) of duplicating inline columns
across both voice-mode-config-bearing tables rather than a shared table.
``auto_detect_language`` is persona-only: HCP reuses the existing
`recognition_language == "auto"` sentinel instead.

Revision ID: k44a_add_speech_recognition_advanced_config
Revises: j43a_add_interim_response_proactive_engagement
Create Date: 2026-08-05
"""

import sqlalchemy as sa

from alembic import op

revision = "k44a_add_speech_recognition_advanced_config"
down_revision = "j43a_add_interim_response_proactive_engagement"
branch_labels = None
depends_on = None

_TABLES = ("hcp_profiles", "avatar_personas")


def upgrade() -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "speech_recognition_model",
                    sa.String(50),
                    server_default="azure-speech",
                    nullable=False,
                )
            )
            batch_op.add_column(
                sa.Column(
                    "eou_detection", sa.Boolean(), server_default=sa.false(), nullable=False
                )
            )
            batch_op.add_column(
                sa.Column(
                    "noise_suppression", sa.Boolean(), server_default=sa.false(), nullable=False
                )
            )
            batch_op.add_column(
                sa.Column(
                    "echo_cancellation", sa.Boolean(), server_default=sa.false(), nullable=False
                )
            )
            batch_op.add_column(
                sa.Column("phrase_list", sa.Text(), server_default="", nullable=False)
            )
            batch_op.add_column(
                sa.Column(
                    "voice_temperature", sa.Float(), server_default="0.9", nullable=False
                )
            )
            batch_op.add_column(
                sa.Column("playback_speed", sa.Float(), server_default="1.0", nullable=False)
            )
            batch_op.add_column(
                sa.Column(
                    "custom_lexicon_url", sa.String(500), server_default="", nullable=False
                )
            )

    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(
            sa.Column(
                "auto_detect_language", sa.Boolean(), server_default=sa.false(), nullable=False
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.drop_column("auto_detect_language")

    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("custom_lexicon_url")
            batch_op.drop_column("playback_speed")
            batch_op.drop_column("voice_temperature")
            batch_op.drop_column("phrase_list")
            batch_op.drop_column("echo_cancellation")
            batch_op.drop_column("noise_suppression")
            batch_op.drop_column("eou_detection")
            batch_op.drop_column("speech_recognition_model")
