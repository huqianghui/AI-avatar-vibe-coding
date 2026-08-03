"""Convert AvatarPersona.greeting to greeting_map + partial unique default
index (Phase 37, PERSONA-07/HARD-01).

`greeting` (single Text column) becomes `greeting_map` (per-locale JSON,
isomorphic to `voice_map`), backfilling each existing row's single greeting
into the `zh-CN` locale key (no data loss -- e.g. the seeded Lisa persona's
greeting survives under `greeting_map["zh-CN"]`).

Also adds `ix_avatar_personas_unique_default`, a partial unique index on
`is_default` scoped to `enabled = 1 AND is_default = 1` (SQLite) /
`enabled = true AND is_default = true` (PostgreSQL) -- defense-in-depth for
the exactly-one-enabled-default invariant, previously enforced only in the
service layer.

Revision ID: f39a_persona_greeting_map_unique_default
Revises: e38a_create_avatar_persona_table
Create Date: 2026-08-02
"""

import json

import sqlalchemy as sa

from alembic import op

revision = "f39a_persona_greeting_map_unique_default"
down_revision = "e38a_create_avatar_persona_table"
branch_labels = None
depends_on = None

# Existing single-greeting rows are backfilled into this locale key.
DEFAULT_BACKFILL_LOCALE = "zh-CN"


def upgrade() -> None:
    bind = op.get_bind()

    # Step 1: add a nullable greeting_map column (batch mode -- SQLite Gotcha #1).
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(sa.Column("greeting_map", sa.Text(), nullable=True))

    # Step 2: backfill each existing row's single greeting into
    # {"zh-CN": "<original greeting>"} -- no data loss.
    rows = bind.execute(sa.text("SELECT id, greeting FROM avatar_personas")).fetchall()
    for row in rows:
        greeting_map = json.dumps({DEFAULT_BACKFILL_LOCALE: row.greeting or ""})
        bind.execute(
            sa.text("UPDATE avatar_personas SET greeting_map = :gm WHERE id = :id"),
            {"gm": greeting_map, "id": row.id},
        )

    # Step 3: tighten greeting_map to NOT NULL and drop the old greeting
    # column (batch mode -- SQLite Gotcha #1).
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.alter_column(
            "greeting_map", existing_type=sa.Text(), nullable=False, server_default="{}"
        )
        batch_op.drop_column("greeting")

    # Step 4: partial unique index -- plain create_index, no batch mode
    # needed (SQLite supports CREATE INDEX ... WHERE without batch, per
    # Gotcha #1 which is scoped to column ALTER only).
    op.create_index(
        "ix_avatar_personas_unique_default",
        "avatar_personas",
        ["is_default"],
        unique=True,
        sqlite_where=sa.text("enabled = 1 AND is_default = 1"),
        postgresql_where=sa.text("enabled = true AND is_default = true"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Step 1 (reverse of upgrade Step 4): drop the partial unique index first.
    op.drop_index("ix_avatar_personas_unique_default", table_name="avatar_personas")

    # Step 2 (reverse of upgrade Step 3): add back a nullable greeting column.
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(sa.Column("greeting", sa.Text(), nullable=True))

    # Step 3 (reverse of upgrade Step 2): backfill greeting from the first
    # available locale in greeting_map (best-effort -- per-locale fidelity is
    # necessarily lost going back to a single greeting column).
    rows = bind.execute(sa.text("SELECT id, greeting_map FROM avatar_personas")).fetchall()
    for row in rows:
        try:
            parsed = json.loads(row.greeting_map or "{}")
        except (json.JSONDecodeError, TypeError):
            parsed = {}
        greeting = next(iter(parsed.values()), "")
        bind.execute(
            sa.text("UPDATE avatar_personas SET greeting = :g WHERE id = :id"),
            {"g": greeting, "id": row.id},
        )

    # Step 4 (reverse of upgrade Step 1): tighten greeting to NOT NULL and
    # drop greeting_map.
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.alter_column(
            "greeting", existing_type=sa.Text(), nullable=False, server_default=""
        )
        batch_op.drop_column("greeting_map")
