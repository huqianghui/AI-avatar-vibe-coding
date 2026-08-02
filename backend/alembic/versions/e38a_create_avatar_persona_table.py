"""Add avatar_personas table (Phase 36, PERSONA-01/02).

Revision ID: e38a_create_avatar_persona_table
Revises: d37a_user_preference_table
Create Date: 2026-08-02
"""

import sqlalchemy as sa

from alembic import op

revision = "e38a_create_avatar_persona_table"
down_revision = "d37a_user_preference_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "avatar_personas",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("character", sa.String(length=100), nullable=False),
        sa.Column("style", sa.String(length=100), nullable=False),
        sa.Column("voice_map", sa.Text(), nullable=False),
        sa.Column("greeting", sa.Text(), nullable=False),
        sa.Column("prompt_fragment", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
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
    op.drop_table("avatar_personas")
