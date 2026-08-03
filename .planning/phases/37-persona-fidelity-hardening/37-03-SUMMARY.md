---
phase: 37-persona-fidelity-hardening
plan: 03
subsystem: ui
tags: [react, typescript, i18n, playwright, react-i18next, admin]

# Dependency graph
requires:
  - phase: 37-01
    provides: "AvatarPersonaOut/Create/Update.greeting_map: dict[str, str] backend contract"
provides:
  - "Per-locale greeting editing in the admin PersonaDialog, mirroring the existing per-locale voice UX"
  - "greeting_map fully replacing greeting across the admin frontend surface (types + UI + save payload)"
  - "5-locale i18n parity for the new personas.greetingSectionTitle key"
  - "A HARD-01-safe admin-avatar-personas.spec.ts that never permanently deletes the seeded default persona"
affects: [admin-persona-management, e2e-test-infra]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-locale form-state loop over a shared locale constant (PERSONA_VOICE_LOCALES) reused identically for both voice Select and greeting Textarea sections"
    - "E2E teardown pattern: record originalDefaultId via API in beforeAll, never let the test body touch it, restore it first in afterAll before deleting any test-created fixtures"

key-files:
  created: []
  modified:
    - frontend/src/api/avatar-personas.ts
    - frontend/src/components/admin/persona-dialog.tsx
    - frontend/src/hooks/use-avatar-personas.test.ts
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/es-ES/admin.json
    - frontend/public/locales/es-MX/admin.json
    - frontend/public/locales/es-US/admin.json
    - frontend/e2e/admin-avatar-personas.spec.ts

key-decisions:
  - "Used an empty-string-deletes-the-key convention for per-locale greeting (no '(use default)' sentinel, unlike voice) since the backend's any-available-locale fallback already handles a locale with no configured greeting"
  - "Restructured the E2E spec around two throwaway personas (A/B) instead of one, so the promote-then-delete assertions never require touching the seeded default persona"
  - "Fixed use-avatar-personas.test.ts's mockPersona fixture even though it isn't in the plan's files_modified list, since the Task 1 type rename made it fail to compile -- a mechanically necessary Rule 1 fix, not scope creep"

patterns-established:
  - "Any future admin per-locale field editor should reuse PERSONA_VOICE_LOCALES/FLAGS/LOCALE_LABEL_KEY verbatim rather than defining a parallel locale list"

requirements-completed: [PERSONA-07, HARD-01]

# Metrics
duration: ~35min
completed: 2026-08-03
---

# Phase 37 Plan 03: Per-locale greeting admin UI + E2E teardown fix Summary

**Admin PersonaDialog now edits greeting text per-locale via `greeting_map` (mirroring the voice-per-language UX exactly), and `admin-avatar-personas.spec.ts` no longer permanently deletes the seeded default persona.**

## Performance

- **Duration:** ~35 min (resumed mid-execution after a context checkpoint; Task 1 code edits were already applied before resume, remaining work was the test-file fix, Tasks 2-3, and full verification)
- **Completed:** 2026-08-03
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments
- `AvatarPersona`/`AvatarPersonaCreate`/`AvatarPersonaUpdate` carry `greeting_map: Record<string, string>` end-to-end, matching the 37-01 backend contract exactly
- `persona-dialog.tsx` Section 4 (Greeting) is now a per-locale `Textarea` loop identical in structure to Section 3 (Voice), sharing the same `PERSONA_VOICE_LOCALES`/`FLAGS`/`LOCALE_LABEL_KEY` constants
- All 5 locale `admin.json` files gained a genuinely-translated `personas.greetingSectionTitle` key; `locale-parity.test.ts` still passes with no new `untranslated-whitelist.ts` entries
- `admin-avatar-personas.spec.ts` rewritten to use two throwaway personas (A/B); the seeded default persona is recorded via API in `beforeAll` and restored in `afterAll` before any deletion is attempted — verified idempotent by running the full suite twice consecutively and confirming (via direct sqlite3 query) the dev DB's persona table is byte-for-byte identical (one row, "Lisa", `is_default=1`) before, between, and after both runs

## Task Commits

1. **Task 1: greeting_map types + per-locale admin form rework** - `ecfa2ec` (feat)
2. **Task 2: i18n parity -- add greetingSectionTitle across all 5 locales** - `c3a7229` (feat)
3. **Task 3: Fix admin-avatar-personas.spec.ts -- never permanently delete the seeded default persona** - `2187f06` (fix)

_No TDD tasks in this plan (all `type="auto"`, no `tdd="true"` markers)._

## Files Created/Modified
- `frontend/src/api/avatar-personas.ts` - `greeting` -> `greeting_map: Record<string, string>` on all three persona interfaces
- `frontend/src/components/admin/persona-dialog.tsx` - `PersonaFormState.greetingMap`, `setGreetingForLocale`, per-locale Section 4 rework, `handleSave` payload update
- `frontend/src/hooks/use-avatar-personas.test.ts` - `mockPersona` fixture updated to `greeting_map` (deviation, see below)
- `frontend/public/locales/{zh-CN,en-US,es-ES,es-MX,es-US}/admin.json` - added `personas.greetingSectionTitle`
- `frontend/e2e/admin-avatar-personas.spec.ts` - restructured around two throwaway personas with a `beforeAll`/`afterAll` teardown pair; greeting locator updated to `#persona-greeting-en-US`

## Decisions Made
- Empty-string-deletes-the-key semantics for per-locale greeting (no default-voice-style sentinel) — matches the backend's existing any-available-locale fallback, so there's no ambiguity about what "not configured for this locale" means.
- Kept `greetingLabel` in all 5 locale files even though it's no longer referenced by the dialog itself (Section 4 now uses `greetingSectionTitle` + `greetingHelper`) — removing a key from only some locale files in the same task would itself risk a parity break; the plan explicitly called for retaining it.
- Two throwaway personas (A/B) instead of one in the E2E spec, so the "promote to default" and "delete succeeds once no longer default" assertions can both be exercised without ever making the seeded default persona a delete target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `use-avatar-personas.test.ts` mockPersona to compile against the new `greeting_map` type**
- **Found during:** Task 1 verification (`cd frontend && npx tsc -b`)
- **Issue:** `frontend/src/hooks/use-avatar-personas.test.ts` (not in this plan's `files_modified` list) constructs a `mockPersona: AvatarPersona` fixture using the old `greeting: "Hi there!"` field. After Task 1's type rename this field no longer exists on `AvatarPersona`, causing a hard TypeScript compile error (`TS2353`) that blocks the plan's own `<verify>` step.
- **Fix:** Changed `greeting: "Hi there!"` to `greeting_map: { "en-US": "Hi there!" }`. No test in the file asserts on this field directly — it's an opaque mock value reused across 5 `describe` blocks — so test intent is fully preserved.
- **Files modified:** `frontend/src/hooks/use-avatar-personas.test.ts`
- **Verification:** `cd frontend && npx tsc -b` passes with zero errors after the fix.
- **Committed in:** `ecfa2ec` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** Mechanically necessary to keep the codebase compiling after the plan's own type rename in `avatar-personas.ts`. No scope creep — no other file referencing "greeting" was touched, since all other occurrences (`public-avatar.ts`, `persona-switcher.tsx`, `user-persona-selection.ts`, and their tests/E2E specs) belong to a distinct, unrelated single-locale end-user-facing greeting field.

## Issues Encountered
None beyond the deviation above. All verification commands passed on the first attempt, including both consecutive Playwright runs required to prove HARD-01's idempotency.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PERSONA-07's admin surface is now complete end-to-end: backend `greeting_map` contract (37-01) + admin editing UI (this plan). Any remaining PERSONA-07 work (e.g. end-user-facing greeting resolution logic) lives outside this plan's scope and was not touched.
- HARD-01 is fixed at its root cause (test teardown), not papered over — verified via two consecutive full spec runs with an explicit before/after DB state check.
- `backend/app/api/public_avatar.py` and `backend/tests/test_public_webrtc_session.py` are being modified concurrently by plan 37-02 in the same working tree; this plan did not touch, stage, or commit those files.

---
*Phase: 37-persona-fidelity-hardening*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 9 claimed modified files verified present on disk; all 3 task commit hashes (`ecfa2ec`, `c3a7229`, `2187f06`) verified present in git history.
