---
phase: 36-avatar-persona-selection-post-login-landing
plan: 4
subsystem: avatar
tags: [fastapi, sqlalchemy, react, tanstack-query, radix-dropdown-menu, webrtc, i18next, playwright]

# Dependency graph
requires:
  - phase: 36-avatar-persona-selection-post-login-landing (36-03)
    provides: "resolve_active_persona() persona resolution service + AvatarPersona catalog wired into WebRTC session config and chat injection"
provides:
  - "GET/PUT /api/v1/users/me/selected-persona self-service endpoint (JWT-gated, upserts UserPreference category=selected_persona_id)"
  - "PersonaSwitcher dropdown component mounted in avatar-page.tsx header, hidden for anonymous visitors"
  - "Session-rebuild-on-switch flow: disconnect current voice session, PUT new selection, reconnect with new personaId, speak persona's greeting via sendTextMessage"
  - "5-locale i18n for personaSwitcher.* (title/switching/error.title/error.body)"
  - "Playwright E2E coverage for the full switch -> toast -> reconnect -> persist-on-reload flow, plus anonymous-hides-switcher regression guard"
affects: ["36-05 (post-login landing)", "future persona-related work touching avatar-page.tsx header or UserPreference categories"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-service preference endpoints reuse the existing multi-row-per-category UserPreference table via upsert-by-category, mirroring the admin-facing persona resolver's enabled-check"
    - "Voice session persona switch follows Phase 34's disconnect+reconnect convention (never a mid-session hot-swap)"

key-files:
  created:
    - backend/app/api/user_persona_selection.py
    - backend/tests/test_user_persona_selection_api.py
    - frontend/src/api/user-persona-selection.ts
    - frontend/src/hooks/use-selected-persona.ts
    - frontend/src/components/avatar/persona-switcher.tsx
    - frontend/src/components/avatar/persona-switcher.test.tsx
    - frontend/e2e/persona-switch.spec.ts
  modified:
    - backend/app/schemas/user_preference.py
    - backend/app/services/avatar_persona_service.py
    - backend/app/main.py
    - frontend/src/api/public-avatar.ts
    - frontend/src/pages/avatar-page.tsx
    - frontend/src/pages/avatar-page.test.tsx
    - frontend/public/locales/en-US/avatar.json
    - frontend/public/locales/zh-CN/avatar.json
    - frontend/public/locales/es-ES/avatar.json
    - frontend/public/locales/es-MX/avatar.json
    - frontend/public/locales/es-US/avatar.json

key-decisions:
  - "set_selected_persona() upserts UserPreference by (user_id, category=selected_persona_id) — updates existing row's value if found, else inserts exactly one new row, single commit"
  - "selected_persona_id added to the PreferenceCategory Literal only, NOT to PREFERENCE_CATEGORIES (that list stays the admin-facing 3-entry dropdown, per 36-03's RESEARCH.md Pitfall 2)"
  - "GET /selected-persona never 404s -- always resolves via resolve_active_persona(), falling back to the admin-marked default, matching PERSONA-02's no-forced-selection guarantee"
  - "PersonaSwitcher's active-row state is driven by the same useSelectedPersona() query the trigger renders from, not a separate local activePersonaId, so the trigger and reload-persistence share one source of truth"
  - "fetchAnonymousWebrtcSession extended with an optional third personaId param (still the JWT-free anonymous endpoint per D-13) -- the frontend passes a persona_id it already validated belongs to the user via the authenticated PUT, so the anonymous WebRTC endpoint never needs its own auth check for this field"
  - "es-ES/es-MX/es-US personaSwitcher.title and .switching kept byte-identical across the three (matching this namespace's pre-existing convention); only error.body was given genuine per-dialect variation (Su/Tu sesión, Compruebe/Verifique/Revisa) to satisfy locale-parity's differs-from-en-US rule without inventing unnecessary divergence"

patterns-established:
  - "Voice-session persona switch UX: toast(\"Switching to {name}...\") shown for the full disconnect->PUT->reconnect->greeting duration; error toast + unchanged trigger state on any failure (no partial UI)"

requirements-completed: [PERSONA-03]

# Metrics
duration: ~95min
completed: 2026-08-02
---

# Phase 36 Plan 4: Self-Service Persona Switcher Summary

**Self-service `GET/PUT /api/v1/users/me/selected-persona` endpoint plus a Radix `DropdownMenu`-based `PersonaSwitcher` in the avatar page header that rebuilds the WebRTC voice session (disconnect/reconnect) and speaks the new persona's greeting on switch, persisted via `UserPreference` and covered by a 5-locale i18n set and an end-to-end Playwright proof.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3 completed
- **Files modified:** 17 (7 created, 10 modified)

## Accomplishments
- Logged-in users can switch their active digital-human persona in-page; the choice survives page reload and future logins via a `UserPreference(category="selected_persona_id")` row, upserted server-side and rejected with 404 for disabled/unknown persona ids (no partial state).
- The switch reuses Phase 34's disconnect+reconnect voice-session convention end-to-end: disconnect -> `PUT` selection -> reconnect with the new `personaId` -> `sendTextMessage(greeting)` once `connected`, with a `"Switching to {name}…"` toast for the duration and a distinct error toast (unchanged trigger) on failure.
- Anonymous visitors never see the switcher (hidden entirely, not disabled) — proven by a dedicated E2E regression guard in a sibling `test.describe` block.
- All 5 locales (`en-US`, `zh-CN`, `es-ES`, `es-MX`, `es-US`) carry genuine `personaSwitcher.*` translations; `untranslated-whitelist.ts` untouched at its 15/15 cap; locale-parity suite (65 tests) green.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN per task):

1. **Task 1: Self-service selected-persona endpoint** — `4b405dc` (test), `aef9bff` (feat)
2. **Task 2: PersonaSwitcher component + avatar-page wiring** — `ffa832a` (test), `1532d93` (feat)
3. **Task 3: i18n (5 locales) + Playwright E2E + full regression** — `1ca45bd` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `backend/app/api/user_persona_selection.py` — `GET`/`PUT /api/v1/users/me/selected-persona`, JWT-gated via `Depends(get_current_user)`, never reads a client-supplied `user_id`
- `backend/app/services/avatar_persona_service.py` — added `set_selected_persona(db, *, user_id, persona_id)`: enabled-check reusing `resolve_active_persona`'s guard, upsert-by-category, single commit
- `backend/app/schemas/user_preference.py` — added `"selected_persona_id"` to the `PreferenceCategory` Literal only (not the admin-facing `PREFERENCE_CATEGORIES` list)
- `backend/app/main.py` — registered the new router alongside the existing personalized-avatar router
- `backend/tests/test_user_persona_selection_api.py` — 8 tests: GET always-resolves, PUT upsert/reject/idempotent-single-row cases
- `frontend/src/api/user-persona-selection.ts` — typed axios client for the new endpoint
- `frontend/src/hooks/use-selected-persona.ts` — `useSelectedPersona()`, `useEnabledPersonas()`, `useSetSelectedPersona()` TanStack Query hooks
- `frontend/src/api/public-avatar.ts` — `fetchAnonymousWebrtcSession` extended with optional `personaId` param; `WebrtcSessionResponse.greeting?: string | null` added to the TS interface
- `frontend/src/components/avatar/persona-switcher.tsx` — DropdownMenu trigger (32px thumbnail + name + `ChevronDown`), enabled-persona list with `Check` on the active row, `null` render when unauthenticated
- `frontend/src/components/avatar/persona-switcher.test.tsx` — 5 unit tests covering hidden/visible/active-row/onSwitch-once behavior
- `frontend/src/pages/avatar-page.tsx` — switch handler: disconnect -> `useSetSelectedPersona()` mutation -> reconnect with new `personaId` -> speak greeting; toast for pending + error states
- `frontend/src/pages/avatar-page.test.tsx` — extended mocks/`beforeEach` resets for the new persona hooks across all 3 describe blocks
- `frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/avatar.json` — added `personaSwitcher.{title,switching,error.title,error.body}`
- `frontend/e2e/persona-switch.spec.ts` — full switch-flow E2E (mocked persona list/selection, fake WebRTC transport) + anonymous-hides-switcher regression guard

## Decisions Made

See frontmatter `key-decisions` for the full list. Most consequential: the anonymous WebRTC session endpoint accepts an optional `personaId` without its own auth check (D-13 precedent) because the frontend only ever forwards a `persona_id` that was already validated server-side by the authenticated `PUT /selected-persona` call — the trust boundary is enforced at the write, not the read.

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<behavior>`/`<action>`/`<verify>`/`<done>` specs; no Rule 1-4 auto-fixes were needed during implementation.

**Note on UI-SPEC interaction-state cosmetics:** the UI-SPEC's Interaction-State-Matrix mentions a spinner overlay on the trigger's thumbnail while switching and a skeleton pill during initial list-loading. This plan wired the underlying boolean `disabled` state (trigger disabled while `useSetSelectedPersona()` is pending, per the threat model's DoS mitigation) but did not add the visual spinner/skeleton treatment — the `must_haves.truths` and `<behavior>` blocks in this plan's own frontmatter do not require those specific visual treatments, only the toast + disabled-trigger + no-partial-UI behavior, all of which are implemented and verified. Flagging here for visibility rather than as a plan violation, since it is out of this plan's literal scope.

## Issues Encountered

- Re-running `npx playwright test e2e/persona-switch.spec.ts` without the `--config=e2e/playwright.config.ts` flag failed both tests with `Cannot navigate to invalid URL` (no `baseURL`, since the default Playwright config differs from this repo's `e2e/playwright.config.ts` — CLAUDE.md Gotcha #5). Re-ran with the explicit `--config` flag: all 4 tests (2 setup + 2 real) passed cleanly. No code changes required — verification-command hygiene only.
- During implementation (prior segment), a Playwright `browser.newContext()`/`test.use({storageState})` scoping bug caused the anonymous-regression test to render fully authenticated when nested under the authenticated describe block. Fixed by moving it to a sibling top-level `test.describe`, matching the established pattern in `personalized-avatar-qa.spec.ts`. Documented in detail in the Task 3 commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PERSONA-03 fully closed: self-service switch, persistence, session rebuild + greeting, anonymous hiding, and 5-locale i18n are all implemented and verified (backend 8/8, frontend unit 5/5 + locale-parity 65/65, E2E 4/4, `tsc -b` clean, `npm run build` green).
- Phase 36 Plan 5 (LAND-01, post-login landing redirect) is unblocked — it depends only on 36-01/36-02/36-03/36-04's persona infrastructure being in place, which it now is.
- No blockers or concerns carried forward.

---
*Phase: 36-avatar-persona-selection-post-login-landing*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: .planning/phases/36-avatar-persona-selection-post-login-landing/36-04-SUMMARY.md
- FOUND: commit 4b405dc
- FOUND: commit aef9bff
- FOUND: commit ffa832a
- FOUND: commit 1532d93
- FOUND: commit 1ca45bd
