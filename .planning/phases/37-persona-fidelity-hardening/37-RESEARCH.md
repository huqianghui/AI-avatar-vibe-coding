# Phase 37: Persona Fidelity & Hardening - Research

**Researched:** 2026-08-02
**Domain:** Azure AI Voice Live avatar/instructions session config, SQLAlchemy/Alembic schema evolution + DB constraints, Playwright E2E hygiene
**Confidence:** MEDIUM-HIGH overall — HIGH on JSON shapes/migration patterns (multi-source verified), MEDIUM on whether `instructions` actually takes effect in this project's agent-mode connection (contradictory sources, needs a live smoke test)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-37-1 | Persona character/style enter the WebRTC `session_config` on the **existing anonymous endpoint** for both auth states (D-13 from Phase 36 stands — JWT never touches it; frontend passes `persona_id`) | Reuse the Phase 36 resolution path (`resolve_active_persona`); no new endpoint |
| D-37-2 | Voice Live `instructions` carries the **sanitized** persona prompt fragment; logged-in path merges CRM/preference context; reuse the existing two-gate sanitization (gate 1 in `avatar_persona_service.py`, gate 2 in the personalization sanitizer) | No new sanitization code paths — proven pipeline |
| D-37-3 | `greeting` → `greeting_map` per-locale JSON (same mechanism/shape as `voice_map`), resolution order: exact locale → any available locale on the persona → hardcoded default copy | Isomorphy keeps admin UX and backend resolution consistent |
| D-37-4 | Alembic migration converts existing `greeting` values into `greeting_map` (keyed under a sensible default locale) — **no data loss**; SQLite requires batch-mode ALTER (Gotcha #1) | Preserve the seeded Lisa greeting and any admin-entered greetings |
| D-37-5 | `is_default` uniqueness → **partial unique index** on (`is_default`) where `enabled=1 AND is_default=1`; service-layer guard stays as the friendly-error layer | Defense in depth; DB is the last line |
| D-37-6 | Persona E2E specs get **teardown**: delete personas they created and restore the prior default; dev DB state must be identical before/after a full E2E run | Dev DB was polluted by Phase 36 E2E runs |
| D-37-7 | Switch rebuild convention unchanged: disconnect + reconnect, no mid-session hot-swap | Phase 34/36 convention |

### Claude's Discretion
None explicitly separated out in CONTEXT.md — the "Research Needed" section (4 numbered questions) delegates the *how* of implementing D-37-1 through D-37-5 to research/planning.

### Deferred Ideas (OUT OF SCOPE)
- Custom Avatar training
- Switch-spam rate limiting (T-36-22 accepted)
- Coach code deletion
- Automatic preference extraction
- 4 pre-existing voice-live-proxy E2E failures (deferred-items.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSONA-05 | Avatar session video appearance must reflect the current persona's character/style over WebRTC (anon + logged-in consistent) | `AvatarConfig` JSON shape (multi-source verified); the project's own hardcoded `AVATAR_WARNING` on the exact endpoint this requirement targets is a load-bearing risk finding — see Common Pitfalls #1 and Architecture Patterns "Two WebRTC transports" |
| PERSONA-06 | Persona prompt fragment must reach the voice channel via `instructions` (sanitized; logged-in merges CRM/preference context) | Official docs confirm `instructions` JSON placement but also state a caveat ("not supported when using a custom agent") that appears to contradict this project's own working agent-mode code sample — see Open Questions #1 |
| PERSONA-07 | `greeting` → per-locale map (voice_map-shaped), resolution + fallback, admin per-locale editing, migration preserves existing greetings | Text+JSON-string convention confirmed from `voice_map`/`AvatarPersonaUpdate` schema; Alembic batch-mode pattern confirmed from `z33a_drop_hcp_inline_voice_fields.py`; exact migration code provided in Code Examples |
| HARD-01 | DB-level partial unique index for `is_default`; E2E teardown so dev DB isn't polluted | `sqlite_where`/`postgresql_where` dialect kwargs confirmed present in installed SQLAlchemy 2.0.48 source; root-cause test (`admin-avatar-personas.spec.ts`) identified by name; working teardown pattern already in `vl-avatar-toggle.spec.ts` |
</phase_requirements>

## Summary

This phase closes four fidelity/hardening gaps left over from Phase 36's audio-first persona delivery. The research surfaced two findings that materially change how risky/scoped each requirement is, both of which CONTEXT.md's "Known Codebase Facts" did not catch because they required reading *comments and warning strings*, not just grepping for missing keys:

1. **PERSONA-05 is riskier than "just add a JSON key."** The exact endpoint D-37-1 designates for the avatar block (`create_public_webrtc_session_config` in `backend/app/services/voice_live_webrtc.py`, backing `POST /public/avatar/webrtc/session`) has shipped since Phase 26 (2026-05-22) with a hardcoded, unconditional `avatar_warning: "Avatar (digital human) is not supported with WebRTC audio transport in preview."` on every response. This is the exact transport this phase must add avatar config to. The warning predates the currently pinned `voice_live_api_version = "2026-07-15"` by ~2 months, so it may be stale — but it also may still be accurate, since Azure's `session.avatar.connect` / `client_sdp` handshake (per official docs) is designed for a **WebSocket-relayed** connection (server forwards SDP), and this project's "calls" signaling URL pattern is a **direct browser-to-Azure** WebSocket that never passes through the backend at all after token issuance. Whether Azure's "calls" endpoint can carry an avatar SDP negotiation the same way is unverified and unverifiable from static analysis — it needs a live smoke test. Fortunately, this project already has a **zero-risk, already-shipped fallback**: `AvatarView`'s static-thumbnail preview layer (Layer 2, keyed by `character`/`style`, already used successfully on the authenticated HCP path). Recommend implementing the `avatar` config block as an attempt (Strategy A) but treating the AvatarView static-preview mode as the committed, planned deliverable (Strategy B) rather than a "nice to have" — see Architecture Patterns.

2. **PERSONA-06's core assumption is contradicted by Azure's own current documentation.** Microsoft Learn's Voice Live how-to page (updated 2026-07-24) states verbatim: *"The `instructions` property isn't supported when you're using a custom agent."* This project's public/anonymous avatar path is **always** in agent mode (`agent_id` + `project_id` are mandatory; the endpoint 409s if `default_project` isn't configured). If "custom agent" in Microsoft's terminology means a Foundry Agent Service agent (which is the most natural reading, and matches this project's own internal `mode_info.get("mode") == "agent"` terminology), then setting `instructions` on this session may be **silently ignored by Azure** rather than erroring — meaning the code "works" (no exception) but the persona's tone never actually changes. This directly contradicts the project's own internal doc (`04-backend-websocket.md`) which shows working code setting `instructions=instructions` while ALSO connecting with `agent_name`/`project_name`. This contradiction could not be resolved via static research — it is now the single highest-priority open question for the plan (see Open Questions #1) and should gate PERSONA-06 behind an early, cheap smoke-test task before deeper investment.

3. **PERSONA-07 and HARD-01 are low-risk, well-precedented work.** The project has an established, singular convention for "per-locale map" columns (`Text` column storing a JSON string, not a native JSON column type, with `json.dumps`/`json.loads` in the service layer and a Pydantic `field_validator(mode="before")` in the schema) — `greeting_map` should mirror `voice_map` exactly, including the migration pattern. SQLAlchemy 2.0.48 (installed, confirmed via source) supports portable partial unique indexes via `sqlite_where=`/`postgresql_where=` dialect kwargs on `Index(...)`, and Alembic 1.18.4 (installed) forwards these through `op.create_index(..., **kw)`.

4. **The dev-DB-pollution root cause is a single identified test.** `frontend/e2e/admin-avatar-personas.spec.ts` creates a persona, promotes it to default, and then **permanently deletes the seeded default (Lisa)** with no teardown — this is the exact bug HARD-01's E2E requirement must fix, not a generic "add teardown everywhere" task.

**Primary recommendation:** Implement PERSONA-05 via the `AvatarConfig` JSON block AND the already-proven `AvatarView` static-preview fallback (don't gate the requirement's success on live avatar-over-"calls" negotiation working); implement PERSONA-06 but add a cheap manual/automated smoke-test task early to confirmy `instructions` actually affects agent-mode voice tone before building deeper CRM-merge logic on top of an assumption that may be false; implement PERSONA-07/HARD-01 by directly mirroring `voice_map`'s existing pattern and fixing the one identified polluting test.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `azure-ai-voicelive` | `1.3.0b1` (pinned, verified in `backend/pyproject.toml` / installed venv) | Voice Live SDK — `RequestSession`, `AvatarConfig`, `AgentConfig` model classes | Already the project's sole SDK for this domain (Phase 29 decision, still pinned) |
| SQLAlchemy | `2.0.48` (installed, verified via `python -c "import sqlalchemy; print(sqlalchemy.__version__)"`) | ORM, `Index(..., sqlite_where=..., postgresql_where=...)` for HARD-01 | Already the project's ORM; dialect-specific partial-index kwargs confirmed present in installed source |
| Alembic | `1.18.4` (installed, verified via `alembic --version`) | Migrations — batch-mode ALTER for SQLite, `op.create_index` dialect kwarg passthrough | Already the project's migration tool |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pydantic v2 | (existing pin) | `field_validator(mode="before")` to parse `greeting_map` JSON-string the same way `voice_map` already does | Every response schema exposing a Text-backed JSON map column |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Text column storing `json.dumps()` string for `greeting_map` | Native `sa.JSON` column type | Native JSON is objectively cleaner, but this project has **zero** precedent for it (`voice_map`, and every other map-shaped column, uses Text+json.dumps); introducing a new convention for one column creates inconsistency for no functional benefit on SQLite/PostgreSQL parity |
| DB partial unique index via SQLAlchemy `Index(sqlite_where=..., postgresql_where=...)` | Raw `CREATE UNIQUE INDEX ... WHERE ...` SQL in an Alembic `op.execute()` | CLAUDE.md forbids raw SQL ("No raw SQL — use SQLAlchemy ORM or Alembic migrations"); the dialect-kwarg approach is portable and matches project convention |
| Persona-switch E2E teardown via direct API calls | UI-driven cleanup (delete via clicking through the admin UI in `afterAll`) | API-based teardown (already the pattern in `vl-avatar-toggle.spec.ts`) is faster and doesn't depend on other UI elements staying stable |

**Installation:** No new packages required — every library above is already installed and pinned.

**Version verification:** Confirmed directly against the installed venv (not npm/pip registry, since these are already pinned dependencies of this exact codebase):
```bash
cd backend && source .venv/bin/activate
python3 -c "import sqlalchemy; print(sqlalchemy.__version__)"   # 2.0.48
alembic --version                                                # 1.18.4
```

## Architecture Patterns

### Two WebRTC transports exist in this codebase — know which one Phase 37 touches

This is the most important non-obvious architectural fact for PERSONA-05:

1. **WebSocket-relayed avatar** (`backend/app/services/voice_live_websocket.py`, `frontend/src/hooks/use-avatar-stream.ts`, `use-voice-live.ts`) — the backend proxies a WebSocket to Azure; ICE/SDP negotiation for avatar happens via `session.avatar.connect` / `session.updated` messages relayed through that same WebSocket. This is the **authenticated HCP training path** (`unified-session.tsx`), and it is the path `docs/voice-live-avatar/06-webrtc-avatar.md` documents in full. Avatar video **does** work here today.
2. **Direct signaling-URL WebRTC** (`backend/app/services/voice_live_webrtc.py`, `frontend/src/hooks/use-voice-live-webrtc.ts`) — the backend only brokers a bearer token and a `wss://.../voice-live/realtime/calls?...` signaling URL; the frontend connects **directly** to Azure (never proxied through the backend after token issuance) and sends `{type: "session.update", session: <session_config>}` over that direct connection. **This is the path D-37-1 targets** — `create_public_webrtc_session_config()`, backing `POST /public/avatar/webrtc/session`, used by both anonymous and logged-in avatar sessions per D-13. This path has shipped with `AVATAR_WARNING = "Avatar (digital human) is not supported with WebRTC audio transport in preview."` unconditionally attached to every response since Phase 26 (2026-05-22) — i.e., before Phase 32's anonymous avatar even existed.

**Recommendation:** Attempt adding the `avatar` config block to path 2's `session_config` (it costs little and may just work — Azure iterates quickly and the warning may be stale), but do not make PERSONA-05's completion contingent on it. Pair it with the already-proven, zero-Azure-risk fallback below.

### Recommended: AvatarConfig JSON block (attempt, verify empirically)

```python
# Source: azure-ai-voicelive 1.3.0b1 installed SDK source
# (.venv/lib/python3.11/site-packages/azure/ai/voicelive/models/_models.py, AvatarConfig)
# cross-verified against official docs (learn.microsoft.com/.../voice-live-how-to,
# "Azure text to speech avatar" section, updated 2026-07-24)
session_config: dict = {
    "voice": {"name": voice_name, "type": "azure-standard"},
    "turn_detection": {"type": "server_vad"},
    "input_audio_noise_reduction": False,
    "input_audio_echo_cancellation": False,
    "modalities": ["text", "audio", "avatar"],  # project's own established pattern
                                                  # (docs/voice-live-avatar/04-backend-websocket.md);
                                                  # official docs' avatar example omits `modalities`
                                                  # entirely, so this may be optional -- keep it for
                                                  # consistency with the project's proven code
    "avatar": {
        "character": persona.character,   # e.g. "lisa"
        "style": persona.style,           # e.g. "casual-sitting"
        "customized": False,              # required bool per SDK; standard avatars only (no training)
        # "video": {"codec": "h264"},     # optional; omit unless a specific resolution/bitrate is needed
    },
}
if sanitized_instructions:
    session_config["instructions"] = sanitized_instructions
```

**Confidence:** HIGH on the JSON shape itself (three independent sources agree: installed SDK model class fields, official Microsoft Learn docs updated 2026-07-24, and this project's own internal doc with real working code). MEDIUM-LOW on whether this shape actually negotiates video over the specific "calls" direct-signaling transport this project uses for the public/anonymous endpoint — unverified, see Open Questions #1... (see PERSONA-05 discussion above).

### Recommended: AvatarView static-preview fallback (proven, ships regardless of Azure's answer)

`frontend/src/components/voice/avatar-view.tsx` already implements a 4-layer render stack (video / static thumbnail / audio-orb fallback / connecting-skeleton) and is **already used successfully** on the authenticated HCP path (`unified-session.tsx`) with real `avatarCharacter`/`avatarStyle` props. The anonymous avatar page (`avatar-page.tsx`) currently hardcodes `isDigitalHumanMode={false}`, which is why this layer never renders there today — not because the mechanism doesn't work, but because it's never been wired up.

```typescript
// frontend/src/pages/avatar-page.tsx — current (audio-only, no persona visual)
<AvatarView
  isDigitalHumanMode={false}
  hcpName=""
  ...
/>

// Recommended: wire the resolved persona's character/style through, mirroring
// unified-session.tsx's existing usage
<AvatarView
  isDigitalHumanMode={true}
  avatarCharacter={activePersona?.character}
  avatarStyle={activePersona?.style}
  ...
/>
```

**Frontend data-plumbing gap identified:** on the anonymous path, `avatar-page.tsx` has **no client-side persona data at all** today — `useEnabledPersonas(isAuthenticated)` / `useSelectedPersona(isAuthenticated)` are both gated on `isAuthenticated`, so an anonymous visitor's query never runs and `enabledPersonasQuery.data` is `undefined`. Since D-13/PERSONA-05 requires anonymous and logged-in paths to render *consistently*, and both paths go through the *same* `/public/avatar/webrtc/session` response object, the cleanest single-source-of-truth fix is to **add `character`/`style` fields to `WebRTCSessionResponse`** (`backend/app/schemas/voice_live.py`), populated from the already-resolved `persona` in `create_public_webrtc_session_config()`. This works uniformly for both auth states without depending on the auth-gated persona-list queries, and needs no new endpoint (satisfies D-37-1's "no new endpoint" constraint since it only adds fields to an existing response).

```python
# backend/app/schemas/voice_live.py — proposed addition
class WebRTCSessionResponse(BaseModel):
    ...
    greeting: str | None = None
    # New (Phase 37, PERSONA-05): resolved active persona's avatar identity,
    # so AvatarView can render the correct static preview / character thumbnail
    # on BOTH anonymous and logged-in paths without depending on the
    # auth-gated persona-list queries.
    character: str | None = None
    style: str | None = None
```

### Recommended: greeting_map mirrors voice_map exactly

```python
# backend/app/models/avatar_persona.py — change
greeting: Mapped[str] = mapped_column(Text, default="")
# to:
greeting_map: Mapped[str] = mapped_column(Text, default="{}")
```

```python
# backend/app/schemas/avatar_persona.py — add, identical pattern to parse_voice_map
@field_validator("greeting_map", mode="before")
@classmethod
def parse_greeting_map(cls, v: str | dict[str, str]) -> dict[str, str]:
    if isinstance(v, str):
        try:
            return json.loads(v or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}
    return v
```

Resolution function should mirror `resolve_voice_for_locale` exactly (same file, `avatar_persona_service.py`):

```python
def resolve_greeting_for_locale(persona: AvatarPersona, locale: str) -> str:
    """Per D-37-3: exact locale -> any available locale on the persona ->
    hardcoded default copy."""
    greeting_map = parse_persona_greeting_map(persona)  # same json.loads-with-fallback pattern
    if locale in greeting_map:
        return greeting_map[locale]
    if greeting_map:
        return next(iter(greeting_map.values()))  # "any available locale on the persona"
    return DEFAULT_GREETING  # hardcoded default copy (D-37-3's third tier)
```

### Recommended: partial unique index (HARD-01)

```python
# backend/app/models/avatar_persona.py — add to AvatarPersona's __table_args__
# Source: sqlalchemy/dialects/sqlite/base.py L800-810, postgresql/base.py L1015-1020
# (both confirmed present in installed SQLAlchemy 2.0.48 source)
from sqlalchemy import Index, text

__table_args__ = (
    Index(
        "ix_avatar_personas_unique_default",
        "is_default",
        unique=True,
        sqlite_where=text("enabled = 1 AND is_default = 1"),
        postgresql_where=text("enabled = true AND is_default = true"),
    ),
)
```

```python
# Alembic migration — op.create_index forwards **kw straight through to Index()
# (confirmed: alembic/operations/toimpl.py create_index() -> operations.impl.create_index(idx, **kw))
def upgrade() -> None:
    op.create_index(
        "ix_avatar_personas_unique_default",
        "avatar_personas",
        ["is_default"],
        unique=True,
        sqlite_where=sa.text("enabled = 1 AND is_default = 1"),
        postgresql_where=sa.text("enabled = true AND is_default = true"),
    )

def downgrade() -> None:
    op.drop_index("ix_avatar_personas_unique_default", table_name="avatar_personas")
```

**Note:** this is a plain `op.create_index`/`op.drop_index`, not a `batch_alter_table` — SQLite's batch-mode requirement (Gotcha #1) applies to `ALTER COLUMN`-style operations (add/drop/modify columns), not to adding an index, so this migration does not need batch mode. Batch mode IS needed for the separate `greeting` → `greeting_map` column change below.

### Recommended: Alembic batch-mode migration for greeting → greeting_map (PERSONA-07 / D-37-4)

```python
"""Convert AvatarPersona.greeting (Text) to greeting_map (Text, JSON-encoded)
(Phase 37, PERSONA-07, D-37-3/D-37-4).

Revision ID: <new>
Revises: e38a_create_avatar_persona_table
Create Date: 2026-08-0X
"""
import json
import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

revision = "<new>"
down_revision = "e38a_create_avatar_persona_table"  # confirmed current head via `alembic heads`
branch_labels = None
depends_on = None

# D-37-4: "a sensible default locale" -- match the project's existing default
# public-facing locale convention (DEFAULT_PUBLIC_VOICE_BY_LOCALE's first key /
# zh-CN, the project's primary supported locale per LANG-01/LANG-02).
DEFAULT_BACKFILL_LOCALE = "zh-CN"


def upgrade() -> None:
    bind = op.get_bind()
    session = orm.Session(bind=bind)

    # 1. Add the new column with a temporary nullable default.
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(sa.Column("greeting_map", sa.Text(), nullable=True))

    # 2. Backfill: wrap every existing greeting string into {locale: greeting}.
    result = bind.execute(sa.text("SELECT id, greeting FROM avatar_personas"))
    for row in result:
        greeting_map = json.dumps({DEFAULT_BACKFILL_LOCALE: row.greeting or ""})
        bind.execute(
            sa.text("UPDATE avatar_personas SET greeting_map = :gm WHERE id = :id"),
            {"gm": greeting_map, "id": row.id},
        )
    session.commit()

    # 3. Tighten the column to NOT NULL and drop the old column (batch mode --
    #    SQLite Gotcha #1 -- both operations happen in the same batch context).
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.alter_column("greeting_map", nullable=False, server_default="{}")
        batch_op.drop_column("greeting")


def downgrade() -> None:
    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.add_column(sa.Column("greeting", sa.Text(), nullable=True))

    bind = op.get_bind()
    result = bind.execute(sa.text("SELECT id, greeting_map FROM avatar_personas"))
    for row in result:
        try:
            parsed = json.loads(row.greeting_map or "{}")
        except (json.JSONDecodeError, TypeError):
            parsed = {}
        greeting = next(iter(parsed.values()), "")
        bind.execute(
            sa.text("UPDATE avatar_personas SET greeting = :g WHERE id = :id"),
            {"g": greeting, "id": row.id},
        )

    with op.batch_alter_table("avatar_personas") as batch_op:
        batch_op.alter_column("greeting", nullable=False, server_default="")
        batch_op.drop_column("greeting_map")
```

**Also update:** `backend/scripts/seed_data.py` line 623 (`greeting="Hi, I'm Lisa! How can I help you today?"`) → `greeting_map=json.dumps({"en-US": "Hi, I'm Lisa! How can I help you today?"})`, matching the existing `voice_map=json.dumps({"en-US": "en-US-AvaNeural"})` pattern on the adjacent line.

### Anti-Patterns to Avoid
- **Don't add a native `sa.JSON` column for `greeting_map`.** Every other map-shaped column in this codebase (`voice_map`) uses `Text` + `json.dumps`/`json.loads`. Introducing a native JSON type for one column breaks the established convention for zero functional benefit and risks subtle SQLite-vs-PostgreSQL serialization differences the Text+string convention was presumably chosen to avoid.
- **Don't build a second, parallel resolution function for greetings that diverges from `resolve_voice_for_locale`'s shape.** The fallback chain in D-37-3 is deliberately isomorphic to the existing voice fallback chain — copy its control flow, don't reinvent it.
- **Don't assume the `AVATAR_WARNING` string reflects current Azure capability.** It's 2.5 months stale relative to the currently pinned API version. Treat it as a hypothesis to test, not a hard blocker — but also don't remove/ignore it without empirical confirmation that avatar negotiates successfully over this specific transport.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persona prompt sanitization | A new sanitizer for the voice/`instructions` path | `sanitize_free_text_with_pii()` (gate 1, already applied at admin-save time in `avatar_persona_service.py`) + the existing gate-2 re-sanitization in `avatar_service.py`/`personalized_avatar_service.py` | D-37-2 explicitly mandates reuse; the two-gate pipeline is already proven and tested |
| CRM/preference context merge for voice instructions | New merge logic | The existing `"\n\n".join(filter(None, [sanitized_persona_fragment, crm_context]))` pattern already used for the chat-injection path | Same merge semantics should apply to voice `instructions` per D-37-2 — one merge convention, not two |
| Exactly-one-default enforcement | A hand-rolled trigger, a `CHECK` constraint with a subquery (not portable), or application-only locking | SQLAlchemy `Index(unique=True, sqlite_where=..., postgresql_where=...)` — a genuine partial unique index on both dialects | Portable, declarative, matches SQLAlchemy's built-in dialect-kwarg mechanism; a subquery `CHECK` constraint isn't expressible/portable this way in either dialect |
| Voice-fallback-style locale resolution for greetings | A new fallback algorithm | Mirror `resolve_voice_for_locale`'s exact 3-tier structure (persona map → [no public-config tier for greeting, per D-37-3's 2-tier + hardcoded-default chain] → hardcoded default) | D-37-3 explicitly designs greeting resolution to be isomorphic to voice resolution — don't diverge |
| E2E cleanup for persona specs | A generic "delete everything created in this test file" sweep | The existing `loginApi`/`createXApi`/`deleteXApi`-in-`try/catch` pattern from `vl-avatar-toggle.spec.ts`, using the admin CRUD routes' `DELETE /admin/avatar-personas/{id}?new_default_persona_id=` | Already proven in this codebase; non-fatal cleanup in `afterAll` avoids masking the actual test's pass/fail with a cleanup failure |

**Key insight:** every non-trivial piece of this phase already has a proven, working precedent somewhere in this codebase (sanitization, voice-map JSON convention, E2E teardown). The main engineering risk isn't inventing new logic — it's correctly locating and mirroring the existing pattern, and empirically verifying the two Azure-specific assumptions (avatar-over-"calls" transport, `instructions`-in-agent-mode) that cannot be resolved by reading code alone.

## Common Pitfalls

### Pitfall 1: Treating the `avatar_warning` string as decorative rather than load-bearing
**What goes wrong:** A plan assumes adding `avatar: {character, style}` to `session_config` is sufficient for PERSONA-05, ships it, and discovers in QA that the video never renders because the "calls" signaling transport doesn't support avatar negotiation (or does, but the warning is simply never cleared from the response, confusing the frontend).
**Why it happens:** CONTEXT.md's codebase-fact verification only grepped for missing `avatar`/`character`/`style` keys — it did not check whether the transport *can* carry them, or read the adjacent warning string/comment explaining why it's there.
**How to avoid:** Treat PERSONA-05 as two deliverables: (1) attempt the native `avatar` config (cheap, might work), (2) ship the `AvatarView` static-preview wiring regardless of (1)'s outcome (proven, zero Azure risk). Clear/conditionalize `avatar_warning` in the response only once (1) is empirically confirmed working.
**Warning signs:** No video track ever arrives in `pc.ontrack`; `AVATAR_WARNING` still present in every response after the change.

### Pitfall 2: Assuming `instructions` silently no-ops safely
**What goes wrong:** PERSONA-06 ships, unit/integration tests pass (they only assert the JSON key is present in `session_config`), but a live conversation shows the persona's tone/personality never actually changes because Azure ignores `instructions` in agent mode.
**Why it happens:** The official Microsoft Learn docs explicitly warn about this ("not supported when using a custom agent") but this project's own internal doc shows a contradicting working code sample — the contradiction is easy to miss if only one source is consulted.
**How to avoid:** Add an early, cheap smoke-test task (manual or automated) that actually asks the digital human a persona-flavored question through the anonymous agent-mode session and confirms the response tone/content reflects the persona fragment, before building the CRM-merge logic on top.
**Warning signs:** Persona switch is visually/audibly confirmed (greeting plays, video/thumbnail changes) but the Q&A personality is identical across all personas.

### Pitfall 3: Introducing a native JSON column for `greeting_map`
**What goes wrong:** A plan naively uses `sa.JSON` for the new column since it's "the correct type for JSON data," creating an inconsistent convention with `voice_map` and every other map-shaped column in the codebase, and risking SQLite/PostgreSQL serialization differences.
**Why it happens:** `sa.JSON` is objectively the more idiomatic SQLAlchemy type; without reading `voice_map`'s existing implementation first, this is the natural first instinct.
**How to avoid:** Explicitly mirror `voice_map`'s `Text` + `json.dumps`/`json.loads` + Pydantic `field_validator(mode="before")` pattern.
**Warning signs:** New column type differs from every other "map" column in `git grep -n "mapped_column(Text"`.

### Pitfall 4: Forgetting batch mode for the column swap but not for the index
**What goes wrong:** Either (a) the `greeting`→`greeting_map` migration fails on SQLite because it's not wrapped in `batch_alter_table`, or (b) the partial-index migration is needlessly wrapped in `batch_alter_table`, which is harmless but inconsistent with the codebase's existing plain `op.create_index` migrations.
**Why it happens:** Gotcha #1 ("SQLite doesn't support ALTER COLUMN") is about column alteration, not index creation — conflating the two leads to either a runtime failure or unnecessary code.
**How to avoid:** Batch mode for `add_column`/`drop_column`/`alter_column` on `greeting`/`greeting_map`; plain `op.create_index`/`op.drop_index` for the partial unique index (SQLite supports `CREATE INDEX ... WHERE ...` without batch mode).
**Warning signs:** `sqlalchemy.exc.OperationalError: near "ALTER": syntax error` on SQLite (missing batch mode), or an unnecessarily verbose migration for the index (unneeded batch mode).

### Pitfall 5: "Fixing" E2E pollution with a blanket teardown-everywhere pass instead of the actual bug
**What goes wrong:** A plan adds generic `afterAll` cleanup to every persona-related spec without noticing that `admin-avatar-personas.spec.ts` specifically **permanently deletes the seeded default persona** (Lisa) as part of its normal test flow, not as leftover test data — meaning even a "clean up what I created" teardown wouldn't restore Lisa, since Lisa was never *created* by the test, she was deleted.
**Why it happens:** "Add teardown to persona E2E specs" sounds like a uniform task; the actual bug is asymmetric (one spec destroys pre-existing seed data, not just its own fixtures).
**How to avoid:** Read `admin-avatar-personas.spec.ts` specifically; the fix must either (a) restore Lisa (or whichever was default) in `afterAll` by re-seeding/re-promoting, or (b) restructure the test to never permanently delete the pre-existing default (e.g., create a throwaway persona, promote it, delete *that one*, and restore the original default — never deleting the seed data at all).
**Warning signs:** After a full E2E run, `GET /admin/avatar-personas` no longer contains a persona named "Lisa" / `character=lisa`.

## Code Examples

### E2E teardown pattern to replicate for persona specs (proven pattern, from `vl-avatar-toggle.spec.ts`)

```typescript
// Source: frontend/e2e/vl-avatar-toggle.spec.ts (already in this codebase)
async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> { /* ... */ }

async function createPersonaApi(request: APIRequestContext, token: string, data: Partial<AvatarPersona>) {
  const res = await request.post(`${API_BASE}/api/v1/admin/avatar-personas`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return res.json();
}

async function deletePersonaApi(
  request: APIRequestContext, token: string, personaId: string, newDefaultPersonaId?: string,
): Promise<void> {
  try {
    const params = newDefaultPersonaId ? `?new_default_persona_id=${newDefaultPersonaId}` : "";
    await request.delete(`${API_BASE}/api/v1/admin/avatar-personas/${personaId}${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Cleanup errors are non-fatal -- don't mask the test's actual assertions.
  }
}

test.describe("Admin avatar personas", () => {
  let token: string;
  let originalDefaultId: string;
  let createdPersonaId: string | undefined;

  test.beforeAll(async ({ request }) => {
    token = await loginApi(request, ADMIN_USER, ADMIN_PASS);
    const current = await request.get(`${API_BASE}/api/v1/admin/avatar-personas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    originalDefaultId = (await current.json()).find((p: AvatarPersona) => p.is_default).id;
  });

  test.afterAll(async ({ request }) => {
    // Restore the original default FIRST (before deleting whatever this spec created),
    // then delete only what this spec itself created -- never the seeded persona.
    if (originalDefaultId) {
      await request.post(
        `${API_BASE}/api/v1/admin/avatar-personas/${originalDefaultId}/set-default`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
    if (createdPersonaId) {
      await deletePersonaApi(request, token, createdPersonaId);
    }
  });

  // ... test bodies set `createdPersonaId` after creating, never delete `originalDefaultId` ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single `Text` greeting column | `greeting_map` per-locale JSON (mirrors `voice_map`) | This phase (37) | Enables locale-correct greetings; migration must backfill without data loss |
| Service-layer-only unique-default guard | Service-layer guard + DB partial unique index | This phase (37) | Defense in depth; DB is now the last line even if a future code path bypasses the service layer |
| Voice-only WebRTC session config | Session config carries `avatar` + `instructions` (attempted) | This phase (37) | If successful, avatar and voice-tone become truly persona-driven; if the "calls" transport can't carry avatar, `AvatarView`'s static preview becomes the committed fallback |

**Deprecated/outdated:** None identified as formally deprecated by Azure; the `AVATAR_WARNING` string is a project-authored comment, not an Azure deprecation notice, and its continued accuracy is unverified (see Open Questions #1).

## Runtime State Inventory

This phase is a schema evolution (Text column → JSON-shaped Text column) plus a new DB index, not a rename/refactor/rebrand. Explicit check against the five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `AvatarPersona.greeting` values (currently just the seeded Lisa row in dev, per CONTEXT.md's "Known Codebase Facts") | Data migration via the Alembic backfill script above (code edit + data migration both required — see Architecture Patterns) |
| Live service config | None — Azure Voice Live config (`azure_voice_live` config row) is untouched; only the per-session JSON payload changes, not any persisted Azure-side resource | None |
| OS-registered state | None — no task schedulers, pm2, or systemd units reference `greeting`/`is_default` | None |
| Secrets/env vars | None — no secret/env var name references the columns being changed | None |
| Build artifacts | None — no compiled/installed artifacts embed the old `greeting` column name | None |

## Common Pitfalls

*(see above — merged into the single Common Pitfalls section per the required document structure; duplicate heading intentionally omitted)*

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Azure's "custom agent" (docs: *"The `instructions` property isn't supported when you're using a custom agent"*) refers to the same thing as this project's Foundry Agent Service `agent_id`+`project_id` connection mode | Summary point 2, Open Questions #1 | If wrong (i.e., "custom agent" means something narrower, e.g. a BYOM-only scenario), `instructions` DOES work for this project's agent-mode sessions, and PERSONA-06 is lower-risk than stated. If right, PERSONA-06 as currently scoped (setting `instructions` on the session) may have zero effect on voice-channel personality, and the CRM-merge logic in D-37-2 would need a different delivery mechanism entirely (e.g., configuring the Foundry Agent's own system prompt per-persona, which is a materially larger scope change) |
| A2 | The `AVATAR_WARNING` string ("Avatar (digital human) is not supported with WebRTC audio transport in preview") is stale/no-longer-accurate for the currently pinned `voice_live_api_version = "2026-07-15"`, since it was authored 2026-05-22 | Summary point 1, Architecture Patterns "Two WebRTC transports" | If the warning is still accurate, adding the `avatar` config block to the "calls" session_config has no effect on video, and PERSONA-05 must rely entirely on the `AvatarView` static-preview fallback (already recommended as the committed deliverable, so this risk is largely pre-mitigated) |
| A3 | "A sensible default locale" for the `greeting` → `greeting_map` backfill (D-37-4) should be `zh-CN`, matching the project's primary/first-listed public locale | Architecture Patterns, migration code | Low risk — this is purely a data-migration key choice; if wrong, the seeded Lisa greeting simply resolves under a different locale key, which the fallback chain (tier 2: "any available locale on the persona") still surfaces correctly for any locale |

## Open Questions

1. **Does `instructions` actually affect agent-mode Voice Live sessions in this project's configuration, or is it silently ignored?**
   - What we know: Official Microsoft Learn docs (updated 2026-07-24) state `instructions` "isn't supported when you're using a custom agent." This project's own internal doc (`04-backend-websocket.md`) shows working code that sets `instructions=instructions` while also connecting with `agent_name`/`project_name` (agent mode) — with no indication in that doc that the field is a no-op.
   - What's unclear: Whether "custom agent" in Microsoft's terminology is synonymous with this project's Foundry Agent Service agent connections (agent_id/project_id), or refers to something narrower (e.g., only BYOM deployments). Static research (SDK source, this project's docs, Microsoft's public docs) could not resolve this — attempts to fetch Microsoft's more specific "connecting an agent" doc page returned 404s during this research session.
   - Recommendation: Add a cheap, early smoke-test task to the plan — connect through the actual anonymous/agent-mode endpoint with two different `instructions` values and manually (or via an automated transcript-content assertion) confirm the response tone/content differs. Gate the CRM-merge portion of PERSONA-06 on this test passing; if it fails, escalate to the user/architect for a scope discussion (the fallback — configuring the Agent's own system prompt per persona server-side via the Foundry Agent Service API — is a materially different and larger piece of work, likely out of this phase's scope).

2. **Does adding `avatar: {character, style}` to the "calls" signaling `session_config` actually negotiate a video track, or does the transport reject/ignore it?**
   - What we know: The exact JSON shape is confirmed correct (SDK source + official docs + project's own internal doc, all agree). The specific transport this phase must modify has shipped a hardcoded "avatar not supported over this WebRTC transport" warning since before this feature area existed.
   - What's unclear: Whether that warning is still true today, and whether it was ever specifically about the "calls" transport vs. some other now-resolved limitation.
   - Recommendation: Attempt it as a cheap, isolated task; verify empirically (manually open the avatar page and watch for a video track / check `pc.ontrack` firing in browser devtools). Do not block PERSONA-05's overall completion on this — ship the `AvatarView` static-preview wiring as the committed, testable deliverable regardless of this task's outcome.

3. **Should `WebRTCSessionResponse`/`WebrtcSessionResponse` gain `character`/`style` fields, or is there a cleaner way for `avatar-page.tsx` to obtain the resolved persona's identity?**
   - What we know: `useEnabledPersonas`/`useSelectedPersona` are both gated on `isAuthenticated`, so the anonymous path has zero client-side persona data today. The WebRTC session endpoint already resolves the active persona server-side (`resolve_active_persona`) for voice/greeting purposes.
   - What's unclear: Whether the planner prefers this (single source of truth, minimal new surface) vs. relaxing the auth-gate on the persona-list queries (larger blast radius, exposes the full persona catalog to anonymous visitors, which may not be desired).
   - Recommendation: Add `character`/`style` to the existing response schema (recommended in Architecture Patterns) — it's the smallest change, requires no new endpoint (satisfies D-37-1), and naturally stays in sync with whatever persona the backend actually resolved for this exact session.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| SQLAlchemy | HARD-01 partial index, PERSONA-07 schema change | ✓ | 2.0.48 | — |
| Alembic | PERSONA-07 migration, HARD-01 migration | ✓ | 1.18.4 | — |
| SQLite (dev) | Local dev DB | ✓ | 3.51.0 (system `sqlite3`) | — |
| azure-ai-voicelive SDK | PERSONA-05/06 session config shape | ✓ | 1.3.0b1 (pinned) | — |
| Azure Voice Live service itself (live API behavior for avatar-over-"calls" and instructions-in-agent-mode) | PERSONA-05, PERSONA-06 | Unverified — cannot be checked via static tooling in this research session; requires a live smoke test against the actual configured Azure resource | — | `AvatarView` static-preview fallback (PERSONA-05); escalate to architect if `instructions` is confirmed ignored (PERSONA-06) |
| Playwright | HARD-01 E2E teardown | ✓ (existing `frontend/e2e/playwright.config.ts`) | (existing pin) | — |

**Missing dependencies with no fallback:** None at the tooling level. The two Azure *behavioral* unknowns above are not "missing dependencies" in the tooling sense but are flagged because they gate whether two of the four requirements' primary implementation strategy will actually work — both have documented fallbacks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3+ (backend, `asyncio_mode = "auto"`), Playwright 1.48+ (E2E) |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]`; `frontend/e2e/playwright.config.ts` |
| Quick run command | `cd backend && pytest tests/test_avatar_persona_service.py tests/test_public_webrtc_session.py tests/test_voice_live_webrtc.py -x` |
| Full suite command | `cd backend && pytest -v` (existing `--cov-fail-under=89` gate); `cd frontend && npx playwright test --config=e2e/playwright.config.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERSONA-05 | `session_config` carries `avatar: {character, style}` matching resolved persona | unit | `pytest tests/test_voice_live_webrtc.py -k avatar -x` | ❌ Wave 0 (extend existing file) |
| PERSONA-05 | `WebRTCSessionResponse` exposes `character`/`style` | unit | `pytest tests/test_public_webrtc_session.py -k character -x` | ❌ Wave 0 |
| PERSONA-05 | AvatarView renders correct thumbnail on persona switch | E2E | `npx playwright test e2e/persona-switch.spec.ts` | ✅ (extend existing) |
| PERSONA-06 | `session_config["instructions"]` carries sanitized persona fragment (+ CRM merge, logged-in) | unit | `pytest tests/test_voice_live_webrtc.py -k instructions -x` | ❌ Wave 0 |
| PERSONA-06 | Live smoke test: instructions actually affect agent-mode session behavior | manual-only (justification: requires a live Azure connection and human/transcript judgment of tone change; not automatable without a live Azure credential in CI) | — | N/A |
| PERSONA-07 | `greeting_map` resolution: exact locale → any locale → hardcoded default | unit | `pytest tests/test_avatar_persona_service.py -k greeting -x` | ❌ Wave 0 |
| PERSONA-07 | Migration backfills existing `greeting` into `greeting_map` without data loss | integration | `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` against a seeded SQLite copy | ❌ Wave 0 |
| PERSONA-07 | Admin form edits greeting per-locale | E2E | `npx playwright test e2e/admin-avatar-personas.spec.ts -g greeting` | ❌ Wave 0 (extend existing) |
| HARD-01 | Partial unique index rejects a second `is_default=true` row at the DB level (bypassing the service layer) | unit | `pytest tests/test_avatar_persona_service.py -k unique_default_db -x` | ❌ Wave 0 |
| HARD-01 | E2E persona specs restore dev DB state (no persona/default left behind after a full run) | E2E | `npx playwright test e2e/admin-avatar-personas.spec.ts e2e/persona-switch.spec.ts && <verify DB state via API>` | ❌ Wave 0 (fix `admin-avatar-personas.spec.ts`'s teardown) |

### Sampling Rate
- **Per task commit:** targeted `pytest -k <feature> -x` per the table above
- **Per wave merge:** `pytest -v` (full backend suite, 89% coverage gate) + relevant Playwright specs
- **Phase gate:** Full suite green (`pytest -v` + full Playwright run) before `/gsd-verify-work`, plus manual confirmation of the two Azure-behavioral open questions

### Wave 0 Gaps
- [ ] Extend `backend/tests/test_voice_live_webrtc.py` with avatar/instructions assertions for `create_public_webrtc_session_config`
- [ ] Extend `backend/tests/test_public_webrtc_session.py` with `character`/`style` response-field assertions
- [ ] Extend `backend/tests/test_avatar_persona_service.py` with `greeting_map` resolution + DB-level unique-default-violation tests
- [ ] New migration integration test (upgrade/downgrade round-trip against seeded data) — no existing file for this pattern in `backend/tests/`
- [ ] Fix `frontend/e2e/admin-avatar-personas.spec.ts`'s teardown (the actual HARD-01 E2E deliverable, not a new file)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no new auth surface in this phase | — |
| V3 Session Management | No — WebRTC session lifecycle unchanged (still disconnect+reconnect, D-37-7) | — |
| V4 Access Control | Yes, indirectly — D-13 continues to hold (anonymous endpoint never receives/requires a JWT; `resolve_active_persona`'s `requested_persona_id` silently falls back to default rather than erroring, which is itself an access-control-adjacent anti-enumeration property) | Reuse existing `resolve_active_persona` precedence chain unchanged |
| V5 Input Validation | Yes — `persona.prompt_fragment` reaching `instructions` is untrusted-ish admin-authored free text reaching an LLM system-prompt-equivalent field | Reuse the existing two-gate `sanitize_free_text_with_pii()` pipeline (gate 1 at admin-save, gate 2 at injection time) — no new sanitizer |
| V6 Cryptography | No — no new secrets/tokens introduced; bearer-token exchange mechanism unchanged | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via admin-authored `prompt_fragment` reaching the voice channel's `instructions` (new attack surface this phase opens, since PERSONA-06 is the first time this field reaches Voice Live) | Tampering / Elevation of Privilege | Two-gate sanitization (already mandated by D-37-2) — do not add a third bespoke path |
| Persona-id enumeration via `requested_persona_id` in the WebRTC session request body | Information Disclosure | Already mitigated — `resolve_active_persona` silently falls back to default for disabled/unknown ids rather than erroring (confirmed in `avatar_persona_service.py`); this phase must not regress that by, e.g., surfacing a distinguishable error when a requested persona's `character`/`style` can't be resolved |
| DB constraint violation on the new partial unique index surfacing a raw 500/IntegrityError to the client if the service-layer guard is ever bypassed | Denial of Service (minor) | Catch `IntegrityError` around the `set_default_persona`/`create_persona` flows and translate to the existing `ConflictException` (409) pattern, consistent with `backend/app/utils/exceptions.py` conventions — don't let a raw DB error leak to the API response |

## Sources

### Primary (HIGH confidence)
- Installed SDK source: `backend/.venv/lib/python3.11/site-packages/azure/ai/voicelive/models/_models.py` (`AvatarConfig`, `RequestSession`, `AgentConfig`) and `_enums.py` (`Modality.AVATAR`) — azure-ai-voicelive 1.3.0b1, confirmed pinned in `backend/pyproject.toml`
- Installed SQLAlchemy 2.0.48 source: `.venv/lib/python3.11/site-packages/sqlalchemy/dialects/sqlite/base.py` (L800-810, `sqlite_where`) and `postgresql/base.py` (L1015-1020, `postgresql_where`)
- Installed Alembic 1.18.4 source: `alembic/operations/toimpl.py` (`create_index` forwards `**kw`)
- [Microsoft Learn — How to use the Voice Live API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to) — fetched 2026-08-02, page `ms.date: 2026-05-25`, `updated_at: 2026-07-24` — "Azure text to speech avatar" section (exact `avatar` JSON shape) and the `instructions`-not-supported-with-custom-agent caveat
- [Microsoft Learn — Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) — fetched 2026-08-02, `updated_at: 2026-06-05` — confirms avatar integration is a first-class documented feature, but does not resolve the "custom agent" terminology question
- This project's own committed code: `backend/app/services/voice_live_webrtc.py`, `backend/app/services/avatar_persona_service.py`, `backend/app/models/avatar_persona.py`, `backend/app/schemas/avatar_persona.py`, `backend/app/schemas/voice_live.py`, `backend/alembic/versions/e38a_create_avatar_persona_table.py`, `backend/alembic/versions/z33a_drop_hcp_inline_voice_fields.py`, `backend/scripts/seed_data.py`
- `git log` on `backend/app/services/voice_live_webrtc.py` — confirmed `AVATAR_WARNING` introduced 2026-05-22 (Phase 26), predating this project's anonymous avatar feature (Phase 32) and current phase (37) by months

### Secondary (MEDIUM confidence)
- `docs/voice-live-avatar/04-backend-websocket.md`, `06-webrtc-avatar.md`, `11-azure-voice-live-reference.md` — this project's own internal architecture docs, showing working code samples that set `instructions` while in agent mode; treated as MEDIUM (not HIGH) because they directly contradict the official Microsoft Learn doc's "custom agent" caveat and the contradiction could not be resolved this session

### Tertiary (LOW confidence)
- None retained as authoritative — WebSearch tool returned repeated `400` errors this session (environment issue, not query-specific) and could not be used; all findings above rely on WebFetch (successful for the two Microsoft Learn pages) and local codebase/tool verification instead

## Metadata

**Confidence breakdown:**
- Standard stack (SQLAlchemy/Alembic versions, dialect kwargs): HIGH — verified directly against installed package source
- Avatar/instructions JSON shapes: HIGH — three independent sources agree
- Whether avatar-over-"calls"-transport and instructions-in-agent-mode actually work in THIS project's live configuration: MEDIUM-LOW — genuinely unresolved, flagged as Open Questions #1/#2 with concrete smoke-test recommendations
- Migration/index patterns: HIGH — directly mirrors existing, already-shipped migrations in this codebase
- E2E teardown root cause: HIGH — read the exact offending spec file and identified the precise bug (permanent deletion of seed data, not generic leftover pollution)

**Research date:** 2026-08-02
**Valid until:** 7 days for the Azure-behavioral open questions (fast-moving preview API, worth re-verifying if the plan isn't executed promptly); 30 days for the SQLAlchemy/Alembic/migration patterns (stable, pinned dependencies)
