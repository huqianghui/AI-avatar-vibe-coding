---
phase: 37-persona-fidelity-hardening
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, sqlite, pydantic, fastapi, avatar-persona, locale, partial-unique-index]

# Dependency graph
requires:
  - phase: 36-avatar-persona-selection-post-login-landing
    provides: AvatarPersona model, avatar_persona_service.py (voice_map resolution pattern), public_avatar.py webrtc_session handler, user_persona_selection.py self-service endpoints
provides:
  - "greeting_map: dict[str, str] per-locale greeting storage on AvatarPersona, replacing the single Text greeting column"
  - "resolve_greeting_for_locale() 3-tier resolution chain (exact locale -> any configured locale -> hardcoded DEFAULT_GREETING)"
  - "DB-level partial unique index (ix_avatar_personas_unique_default) enforcing exactly-one-enabled-default at the SQLite/PostgreSQL layer"
  - "IntegrityError -> ConflictException (409) translation in create_persona/set_default_persona"
affects: [persona-admin-ui, persona-selection-ui, webrtc-session-init, future-locale-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-locale JSON-as-Text column pattern (greeting_map mirrors voice_map exactly) — never sa.JSON, always Text + json.dumps/loads with try/except fallback"
    - "3-tier locale resolution chain: exact match -> any configured value -> hardcoded default, never raises/empty"
    - "DB-level partial unique index as defense-in-depth for a business invariant already enforced in the service layer"
    - "IntegrityError caught at the service layer and translated to ConflictException, never leaking as a raw 500"

key-files:
  created:
    - backend/alembic/versions/f39a_persona_greeting_map_unique_default.py
  modified:
    - backend/app/models/avatar_persona.py
    - backend/app/schemas/avatar_persona.py
    - backend/app/services/avatar_persona_service.py
    - backend/app/api/public_avatar.py
    - backend/app/api/user_persona_selection.py
    - backend/scripts/seed_data.py
    - backend/tests/test_avatar_persona_service.py
    - backend/tests/test_public_webrtc_session.py
    - backend/tests/test_admin_avatar_personas_api.py
    - backend/tests/test_avatar_personas_api.py
    - backend/tests/test_user_persona_selection_api.py

key-decisions:
  - "Backfilled all pre-existing greeting text into the zh-CN locale key during migration (DEFAULT_BACKFILL_LOCALE constant) since the dev DB's only persona (seeded Lisa) had an unlocalized greeting"
  - "Used alembic stamp (not migration replay or DB deletion) to fix a pre-existing alembic_version drift discovered while verifying this plan's migration — the dev DB schema was already at the true head via dev-mode create_all(), but the version pointer was stale"
  - "Removed a self-authored TDD test (test_create_persona_second_default_translates_to_conflict) after determining it didn't reflect real behavior: create_persona's clear-all-then-set pattern via set_default_persona never triggers a real IntegrityError in that code path — the DB-level guard is proven instead via a direct-ORM-bypass test"

patterns-established:
  - "Locale-keyed JSON-as-Text columns: greeting_map is now the second field (after voice_map) following this exact convention — future per-locale fields should mirror it"
  - "Partial unique index as a business-invariant safety net: sqlite_where/postgresql_where dual-dialect Index() alongside a service-layer try/except IntegrityError guard"

requirements-completed: [PERSONA-07, HARD-01]

# Metrics
duration: 55min
completed: 2026-08-03
---

# Phase 37 Plan 01: Persona Greeting Locale Map + DB-Level Default Uniqueness Summary

**Converted `AvatarPersona.greeting` from a single Text column into a per-locale `greeting_map` (isomorphic to `voice_map`) with a 3-tier resolution chain, and added a partial unique index that makes SQLite/PostgreSQL itself refuse a second enabled default persona.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-03T08:14:00Z (approx, per commit timestamps)
- **Completed:** 2026-08-03T09:09:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments
- `greeting_map: dict[str, str]` fully replaces the single `greeting: str` column across model, Alembic migration, Pydantic schemas, service layer, and every API call site — zero dangling references to the old column anywhere in `backend/`
- `resolve_greeting_for_locale()` resolves correctly for exact-locale, any-available-locale, and zero-configured-locale cases, mirroring the proven `resolve_voice_for_locale` pattern
- A DB-level partial unique index (`ix_avatar_personas_unique_default`) now rejects a second enabled default persona even when the service-layer guard is bypassed via direct ORM construction — verified with a dedicated integration test
- Migration is fully reversible (`upgrade` / `downgrade -1` / `upgrade` round-trip verified) with zero data loss for the seeded Lisa persona

## Task Commits

Each task was committed atomically:

1. **Task 1: Data-layer contracts — model column swap + partial unique index + Alembic migration** - `433e747` (feat)
2. **Task 2: Greeting resolution chain + DB-integrity guard in the service layer** - `1e8d392` (feat, TDD)
3. **Task 3: Fix call-site ripple (public_avatar.py, user_persona_selection.py, seed_data.py) and remaining test fixtures** - `11d8d64` (fix)

**Plan metadata:** (this commit, pending)

_Note: Task 2 was TDD but was committed as a single feat commit covering both RED and GREEN phases together, since the test file and service implementation were developed in tight iteration._

## Files Created/Modified
- `backend/app/models/avatar_persona.py` - `greeting_map` column + partial unique index on `(is_default)` where `enabled=1 AND is_default=1`
- `backend/alembic/versions/f39a_persona_greeting_map_unique_default.py` - Batch-mode column swap (greeting -> greeting_map, backfilled to zh-CN) + plain `create_index` for the partial unique index, both reversible
- `backend/app/schemas/avatar_persona.py` - `AvatarPersonaCreate/Update/Out` carry `greeting_map: dict[str, str]` with a `parse_greeting_map` validator mirroring `parse_voice_map`
- `backend/app/services/avatar_persona_service.py` - `parse_persona_greeting_map()`, `resolve_greeting_for_locale()`, `DEFAULT_GREETING` constant, `IntegrityError -> ConflictException` translation in `create_persona`/`set_default_persona`
- `backend/app/api/public_avatar.py` - `webrtc_session` now calls `resolve_greeting_for_locale(persona, body.locale)` instead of reading `persona.greeting`
- `backend/app/api/user_persona_selection.py` - GET/PUT `/users/me/selected-persona` both accept a locale (query param / body field) and resolve greeting explicitly instead of via `from_attributes` passthrough
- `backend/scripts/seed_data.py` - Seeds Lisa's greeting via `greeting_map=json.dumps({"en-US": "..."})`
- `backend/tests/test_avatar_persona_service.py` - New `TestParsePersonaGreetingMap`, `TestResolveGreetingForLocale`, `TestUniqueDefaultDatabaseConstraint` classes; existing fixtures/assertions updated to `greeting_map`
- `backend/tests/test_public_webrtc_session.py`, `test_admin_avatar_personas_api.py`, `test_avatar_personas_api.py`, `test_user_persona_selection_api.py` - Fixtures and payloads updated from `greeting` to `greeting_map`

## Decisions Made
- Backfilled all existing greeting text into the `zh-CN` locale key during migration (module constant `DEFAULT_BACKFILL_LOCALE`), matching the only real data present in the dev DB (seeded Lisa, unlocalized greeting)
- Kept `SelectedPersonaOut.greeting: str` as a single resolved field (not exposing raw `greeting_map`) since that endpoint's contract is "the greeting to show/speak right now for this user's locale" — only the admin CRUD surface exposes the raw per-locale map
- Did not add a `greeting_map` sanitization gate (unlike `prompt_fragment`) since greeting text is spoken/displayed verbatim, not injected into a system prompt — documented explicitly in the plan's threat model as `accept` disposition (T-37-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing alembic_version drift blocking migration verification**
- **Found during:** Task 1 (running `alembic upgrade head` to verify the new migration)
- **Issue:** `alembic upgrade head` failed with `sqlite3.OperationalError: table user_crm_contexts already exists`. Root cause: the dev DB's actual schema was already at the true migration head (created via `Base.metadata.create_all()` at app dev-startup, which runs ahead of Alembic in this project's dev workflow), but the `alembic_version` table was stamped at a stale revision (`b35a_add_anonymous_avatar_tables`) — a pre-existing drift unrelated to this plan's changes.
- **Fix:** Backed up the DB file first (`cp ai_coach.db ai_coach.db.bak-37-01`, gitignored, never deleted the live DB). Verified via direct `sqlite3` inspection that the actual `avatar_personas`/`hcp_profiles` schemas exactly matched the true head. Ran `alembic stamp e38a_create_avatar_persona_table` to align the version pointer without replaying already-applied DDL. Then re-verified the round-trip: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` — all three steps passed cleanly.
- **Files modified:** None (backend code) — only the dev DB's internal `alembic_version` table pointer was corrected; `ai_coach.db.bak-37-01` left on disk as a safety backup (gitignored via `*.db.bak-*`)
- **Verification:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` all exit 0; `sqlite3 ai_coach.db "SELECT id, greeting_map, enabled, is_default FROM avatar_personas;"` confirms Lisa's row: `{"zh-CN": "Hi, I'm Lisa! How can I help you today?"}` intact, `enabled=1`, `is_default=1`
- **Committed in:** Not a code change — no commit needed (dev-environment-only DB state fix)

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only, no code changed)
**Impact on plan:** No scope creep. The migration itself was correct on the first attempt; the drift was pre-existing dev-environment state unrelated to any file this plan touches.

## Issues Encountered
- **2 pre-existing, out-of-scope test failures** in the full backend suite (`pytest -q`, 2890 passed / 2 failed / 15 skipped / 28 deselected): `tests/test_voice_live_websocket.py::TestRealAzureSessionConfig::test_real_connect_model_mode_session_config_accepted` and `::TestRealVoiceLiveIntegration::test_real_model_mode_with_instructions`. Both test classes carry `pytestmark = [pytest.mark.skipif(not REAL_FOUNDRY_ENDPOINT or not REAL_FOUNDRY_API_KEY, ...)]`; this sandbox's `.env` has real Azure credentials configured, so the skip condition is false and the tests attempt a genuine outbound network call, failing with `ConnectionError` at `azure/ai/voicelive/aio/_patch.py:787` due to sandbox network restrictions. Neither test file nor any code path it exercises appears in this plan's `files_modified` list. Classified as a pre-existing, environment-dependent, out-of-scope failure per the deviation scope-boundary rules — not fixed, logged here for visibility. Coverage requirement still met: 90.22% (threshold 89%).
- **Background-job management inefficiency during full-suite verification:** an initial foreground `pytest -q` call silently auto-converted to a background job with output piped to `tail`, producing no visible progress for an extended period; manual polling of the wrong log file compounded the delay. Resolved by re-running with explicit `run_in_background: true`, redirecting output to a dedicated log file with an `EXIT:$?` completion marker, and using a `until grep -q "EXIT:" ...` monitor loop instead of manual polling. A duplicate concurrent `pytest` process (from the stuck first attempt) was also found via `ps aux` and killed, after which the remaining process's CPU utilization and progress returned to normal. No functional impact — purely a verification-speed issue, not a code or test defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `greeting_map` and the partial unique index are fully wired end-to-end (model, migration, schema, service, all API call sites, all tests) — ready for any downstream phase that builds admin UI or additional locale-aware persona features on top of this data layer
- Dev DB verified consistent: seeded Lisa persona survives the migration with `greeting_map = {"zh-CN": "Hi, I'm Lisa! How can I help you today?"}`, `enabled=1`, `is_default=1`
- No blockers. The 2 unrelated real-Azure-network test failures are environment-dependent (require outbound network access this sandbox lacks) and pre-exist this plan; they do not block phase 37 progress but should be re-verified in a network-enabled CI environment.

---
*Phase: 37-persona-fidelity-hardening*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 12 claimed created/modified files verified present on disk. All 3 task commit hashes (`433e747`, `1e8d392`, `11d8d64`) verified present in git history.
