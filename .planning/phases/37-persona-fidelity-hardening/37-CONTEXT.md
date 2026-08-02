# Phase 37 Context: Persona Fidelity & Hardening

**Created:** 2026-08-02
**Source:** Post-Phase-36 holistic gap analysis (user-requested), codebase-verified.
**Requirements:** PERSONA-05, PERSONA-06, PERSONA-07, HARD-01

## Why This Phase Exists

Phase 36 delivered the persona catalog, switching, and persistence **audio-first**: voice
selection (3-tier fallback), greeting playback (via `sendTextMessage`), and prompt-fragment
injection into the *chat* endpoints all work. But a persona switch is not fully observable:

1. **Video appearance never changes.** `backend/app/api/voice_live_webrtc.py` builds
   `session_config` with **no avatar character/style fields** — the on-screen digital human
   is whatever the Azure Voice Live default renders, regardless of persona. Verified by grep:
   no `character`/`style` keys anywhere in the session config assembly.
2. **Voice-channel personality never changes.** `session_config` carries **no `instructions`
   field**. The persona `prompt_fragment` only reaches the text-chat paths
   (`avatar_service.py` / `personalized_avatar_service.py`); spoken Q&A through Voice Live
   ignores it entirely.
3. **Greeting is locale-blind.** `AvatarPersona.greeting` is a single `Text` column. A
   Chinese greeting gets spoken in a Spanish session. `voice_map` already solved this shape
   (per-locale JSON map + fallback) — greeting should be isomorphic.
4. **Integrity is service-layer-only.** Exactly-one-default is guarded in
   `avatar_persona_service.py` but not by a DB constraint. E2E runs created personas in the
   shared dev SQLite DB and left them behind (we manually cleaned `E2E Persona 1785674746608`
   and reseeded Lisa on 2026-08-02).

## Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-37-1 | Persona character/style enter the WebRTC `session_config` on the **existing anonymous endpoint** for both auth states (D-13 from Phase 36 stands — JWT never touches it; frontend passes `persona_id`) | Reuse the Phase 36 resolution path (`resolve_active_persona`); no new endpoint |
| D-37-2 | Voice Live `instructions` carries the **sanitized** persona prompt fragment; logged-in path merges CRM/preference context; reuse the existing two-gate sanitization (gate 1 in `avatar_persona_service.py`, gate 2 in the personalization sanitizer) | No new sanitization code paths — proven pipeline |
| D-37-3 | `greeting` → `greeting_map` per-locale JSON (same mechanism/shape as `voice_map`), resolution order: exact locale → any available locale on the persona → hardcoded default copy | Isomorphy keeps admin UX and backend resolution consistent |
| D-37-4 | Alembic migration converts existing `greeting` values into `greeting_map` (keyed under a sensible default locale) — **no data loss**; SQLite requires batch-mode ALTER (Gotcha #1) | Preserve the seeded Lisa greeting and any admin-entered greetings |
| D-37-5 | `is_default` uniqueness → **partial unique index** on (`is_default`) where `enabled=1 AND is_default=1`; service-layer guard stays as the friendly-error layer | Defense in depth; DB is the last line |
| D-37-6 | Persona E2E specs get **teardown**: delete personas they created and restore the prior default; dev DB state must be identical before/after a full E2E run | Dev DB was polluted by Phase 36 E2E runs |
| D-37-7 | Switch rebuild convention unchanged: disconnect + reconnect, no mid-session hot-swap | Phase 34/36 convention |

## Known Codebase Facts (verified 2026-08-02)

- `session_config` assembly: `backend/app/api/voice_live_webrtc.py` — currently voice-only
  config; no `avatar`, `character`, `style`, or `instructions` keys.
- `resolve_active_persona(db, *, user_id, requested_persona_id)` and
  `resolve_voice_for_locale` live in `backend/app/services/avatar_persona_service.py` (36-03).
- `WebRTCSessionResponse` base schema (`backend/app/schemas/voice_live.py`) already carries
  `greeting: str | None` (36-03 deviation — placed on the base schema).
- Frontend already passes `persona_id` into `fetchAnonymousWebrtcSession(sessionToken, locale, personaId)`
  and plays `greeting` via `voiceLive.sendTextMessage` after `connected` (36-04).
- Admin persona dialog: `frontend/src/pages/admin/avatar-personas.tsx` + form component (36-02);
  rows carry `data-testid="persona-row"` / `data-persona-id`.
- Seed: `seed_default_avatar_persona` (backend/scripts/seed_data.py) creates Lisa
  (`lisa` / `casual-sitting`, voice_map `{"en-US": "en-US-AvaNeural"}`), idempotent
  (skips if ANY persona row exists).
- Azure constraint: standard avatars only (lisa/harry/meg/max + styles); no custom training.

## Research Needed (feeds 37-RESEARCH.md)

1. Azure AI Voice Live API: exact `session_config` shape for **avatar video** — where do
   `character` and `style` go (e.g. `avatar: {character, style}` block)? Which SDK/protocol
   version does the current proxy speak (Phase 29 refactor used azure-ai-voicelive SDK)?
2. `instructions` field semantics in Voice Live session config — session-level system prompt;
   length limits; interaction with server-side agent mode (`agent_id` present in response schema).
3. Alembic batch-mode migration pattern for `Text` → JSON column on SQLite + PostgreSQL.
4. Partial unique index syntax portable across SQLite (dev) and PostgreSQL (prod) via SQLAlchemy/Alembic.

## Out of Scope (unchanged)

- Custom Avatar training; switch-spam rate limiting (T-36-22 accepted); coach code deletion;
  automatic preference extraction; 4 pre-existing voice-live-proxy E2E failures (deferred-items.md).
