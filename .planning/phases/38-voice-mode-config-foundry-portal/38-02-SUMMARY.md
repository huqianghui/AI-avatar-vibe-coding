---
phase: 38-voice-mode-config-foundry-portal
plan: 02
subsystem: ui
tags: [react, react-hook-form, zod, playwright, vitest, i18n, fastapi, pydantic]

# Dependency graph
requires:
  - phase: 38-voice-mode-config-foundry-portal (Plan 38-01)
    provides: "Inline HcpProfile columns (voice_live_model, voice_name, recognition_language, avatar_character, avatar_style, avatar_enabled) and resolve_voice_config() reading them directly instead of a VoiceLiveInstance FK"
provides:
  - "Foundry-portal-style 'Voice & Avatar Configuration' card in the HCP profile editor, replacing the removed 'Voice Live Instance' selector card"
  - "Shared, standalone AvatarCharacterGallery component (filterable all/photo/video, thumbnail-fallback-to-initials) reusable by both the HCP and persona editors"
  - "hcpSchema with voice_live_instance_id fully optional/nullable; brand-new HCP profiles creatable end-to-end without ever touching a VoiceLiveInstance"
  - "E2E coverage proving the configure -> save -> reload -> persisted flow for all 6 direct voice-mode fields"
affects: [38-03-persona-editor-parity, hcp-profile-editor, agent-config-left-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared gallery/select components extracted from persona-editor.tsx into standalone, testable components (AvatarCharacterGallery) consumed by multiple admin editors"
    - "voice-constants.ts as the single source of truth for locale label/flag maps shared across HCP and persona editors"

key-files:
  created:
    - frontend/src/components/admin/avatar-character-gallery.tsx
    - frontend/src/components/admin/avatar-character-gallery.test.tsx
    - frontend/e2e/hcp-editor-voice-tab.spec.ts (rewritten)
  modified:
    - frontend/src/components/admin/agent-config-left-panel.tsx
    - frontend/src/components/admin/agent-config-left-panel.test.tsx
    - frontend/src/pages/admin/hcp-profile-editor.tsx
    - frontend/src/pages/admin/hcp-profile-editor.test.tsx
    - frontend/src/types/hcp.ts
    - frontend/src/lib/voice-constants.ts
    - frontend/src/__tests__/hcp-editor-tabs.test.tsx
    - frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/admin.json
    - backend/app/api/hcp_profiles.py (Rule 1 deviation)

key-decisions:
  - "Extracted AvatarCharacterGallery as a standalone component (not inline JSX) so Plan 38-03's persona-editor parity work can reuse it verbatim"
  - "Left decorative AgentFoundationModelSelect card untouched; the new VoiceLiveModelSelect-backed 'Model deployment' control is a distinct, unrelated field bound to voice_live_model"
  - "Kept unused vlInstance* i18n keys in place rather than deleting them across 5 locale files, matching the existing codebase norm for retired-but-harmless keys"

requirements-completed: [VMODE-01]

# Metrics
duration: 43min
completed: 2026-08-04
---

# Phase 38 Plan 02: Voice Mode Config (Foundry Portal Style) Summary

**Replaced the HCP editor's "Voice Live Instance" selector card with a direct Foundry-portal-style config card (model/language/voice dropdowns, avatar toggle, character gallery) wired to 6 inline `HcpProfile` fields, and fixed a real backend serialization bug that silently dropped those fields from every API response.**

## Performance

- **Duration:** 43 min (commit-to-commit; additional time spent on post-implementation debugging of a real persistence bug and E2E-runner environment issues, detailed below)
- **Started:** 2026-08-04T12:54:30+08:00
- **Completed:** 2026-08-04T13:37:03+08:00
- **Tasks:** 3
- **Files modified:** 27 (across all 3 tasks' commits)

## Accomplishments
- Removed the "Voice Live Instance" card (selector, badges, unassign dialog, "Manage in Voice Live" link) and all its now-dead hooks/state from `agent-config-left-panel.tsx`
- Added a new "Voice & Avatar Configuration" card: `VoiceLiveModelSelect`, a Language `<Select>` (5 supported locales + "auto"), a Speech-output Voice `<Select>`, an `avatar_enabled` `<Switch>`, and `<AvatarCharacterGallery>` — all bound to real, persisted `HcpProfile` fields
- Extracted `AvatarCharacterGallery` as a standalone, unit-tested, reusable component (filter by all/photo/video, thumbnail-error fallback to initials) from persona-editor.tsx's previously-inline gallery markup
- Relaxed `hcpSchema`'s `voice_live_instance_id` to nullable/optional — a brand-new HCP profile can now be created end-to-end without ever touching a `VoiceLiveInstance`
- Added the `hcp.voiceAvatarConfigTitle` i18n key across all 5 locales, plus a static regression guard asserting the VL Instance card's markers (`useVoiceLiveInstances`, `vlInstanceEmptyTitle`) never reappear
- Rewrote `hcp-editor-voice-tab.spec.ts` end-to-end: visibility of the new card with zero VL-instance text, full configure→save→reload→persistence flow, and playground-visibility regardless of avatar-enabled state — while preserving all unrelated pre-existing tests (notably the Foundry IQ knowledge-base attach flow)
- **Found and fixed a real production bug** (Rule 1 deviation): the backend's `HcpProfileOut` response model (used by every HCP-profiles GET/POST/PUT/retry-sync endpoint) was missing all 6 VMODE-01 fields, so every API response silently dropped them even though they were correctly persisted to the database — meaning every page reload would have reverted the editor to hardcoded defaults, defeating the entire feature. Caught only because the E2E persistence test forced a real round-trip through the live backend (unit/component tests mock the API layer and couldn't have caught this).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared locale constants + build AvatarCharacterGallery component** - `585edd3` (test) → `9998336` (feat)
2. **Task 2: Replace the Voice Live Instance card with direct voice-mode config** - `331e9d7` (feat)
3. **Task 3: New card title string, tab-structure regression guard, and E2E coverage** - `1ccaa22` (feat, includes the Rule 1 backend fix)

**Plan metadata:** this SUMMARY.md commit (docs)

_Note: Task 1 used the TDD RED→GREEN pattern (test commit then feat commit); Tasks 2 and 3 combined behavior + implementation into single commits per plan scope._

## Files Created/Modified
- `frontend/src/lib/voice-constants.ts` - Added shared `SUPPORTED_VOICE_LOCALES`/`LOCALE_FLAGS`/`LOCALE_LABEL_KEY` exports (extracted verbatim from persona-editor.tsx)
- `frontend/src/components/admin/avatar-character-gallery.tsx` - New standalone filterable avatar+style picker component
- `frontend/src/components/admin/avatar-character-gallery.test.tsx` - RTL coverage: render count, onSelect, selection ring, filters, thumbnail-error isolation
- `frontend/src/components/admin/agent-config-left-panel.tsx` - VL Instance card removed; new "Voice & Avatar Configuration" card added
- `frontend/src/components/admin/agent-config-left-panel.test.tsx` - Rewritten to match the new card's controls
- `frontend/src/pages/admin/hcp-profile-editor.tsx` - `voice_live_instance_id` now nullable/optional in `hcpSchema`; 6 new zod fields with defaults; removed dead VL-instance-required save guard
- `frontend/src/pages/admin/hcp-profile-editor.test.tsx` - Rewritten `voice_live_instance_id` validation tests (empty/null now succeed)
- `frontend/src/types/hcp.ts` - Added the 6 fields to `HcpProfile`; `voice_live_instance_id` now optional on `HcpProfileCreate`
- `frontend/src/__tests__/hcp-editor-tabs.test.tsx` - Added `voiceAvatarConfigTitle` to the i18n parity array; added a static regression guard against the VL Instance card's markers reappearing
- `frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/admin.json` - Added `hcp.voiceAvatarConfigTitle` key across all 5 locales
- `frontend/e2e/hcp-editor-voice-tab.spec.ts` - Fully rewritten: removed 5 obsolete VL-instance-dependent tests, added 3 new VMODE-01 tests, preserved all unrelated tests
- `backend/app/api/hcp_profiles.py` - **Rule 1 fix**: added the 6 VMODE-01 fields to the `HcpProfileOut` response model so they're no longer silently dropped from API responses

## Decisions Made
- `AvatarCharacterGallery` extracted as its own component (not left inline) specifically to be reused verbatim by Plan 38-03's persona-editor parity work, per the plan's stated purpose
- Kept the pre-existing decorative `AgentFoundationModelSelect` "Model Deployment" card untouched — it is a different, unrelated chat-completion-model catalog selector, out of this plan's scope
- Left the unused `vlInstance*` i18n keys in all 5 locale files rather than deleting them, matching the existing codebase norm for retired-but-harmless translation keys (e.g. `knowledgePlaceholder`/`toolsPlaceholder`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backend `HcpProfileOut` response model missing all 6 VMODE-01 fields**
- **Found during:** Task 3 (E2E persistence test)
- **Issue:** `agent-config-left-panel.tsx` and `hcp-profile-editor.tsx` correctly built and sent PUT payloads with the 6 new fields, and the service layer correctly persisted them to the database (verified via direct `curl` login→GET→PUT→GET round-trip), but every GET/POST/PUT response serialized through the router's locally-defined `HcpProfileOut` Pydantic class, which never declared these 6 fields. Pydantic's `from_attributes=True` silently dropped them from every response, so every full page reload of the HCP editor fell back to hardcoded form defaults regardless of what was actually saved — defeating the entire point of Task 2's new UI. A separate, unused `HcpProfileResponse` class in `app/schemas/hcp_profile.py` already declared them correctly but was never wired to any route.
- **Fix:** Added `voice_live_model`, `voice_name`, `recognition_language`, `avatar_character`, `avatar_style`, `avatar_enabled` (plus the now-vestigial `voice_live_instance_id`) to `HcpProfileOut` in `backend/app/api/hcp_profiles.py`, matching the defaults used elsewhere.
- **Files modified:** `backend/app/api/hcp_profiles.py`
- **Verification:** Direct `curl` round-trip confirmed the fields now appear in GET responses; full backend `pytest -k hcp_profile` (89/89) passed; E2E persistence test (`hcp-editor-voice-tab.spec.ts`) passed end-to-end afterward.
- **Committed in:** `1ccaa22` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness — without this fix, the entire VMODE-01 feature would silently fail to persist visibly to admins on every page reload. No scope creep; fix confined to the exact 6 fields this plan introduces.

## Issues Encountered
- **E2E test navigation flow**: Saving an existing HCP profile navigates away to the profile list page (`handleSubmit`'s `onSuccess`), so the persistence-check step in the E2E test had to capture the editor URL upfront and re-navigate via `page.goto(editUrl)` rather than `page.reload()`.
- **Splash-screen overlay intercepting clicks**: A full-screen auth-bootstrap overlay (`fixed inset-0 z-50 ...`) briefly covers the page after a fresh navigation, even though `[role='tab']` elements already exist underneath it in the DOM. Fixed by waiting for the overlay to become hidden before interacting with tabs.
- **E2E CLI invocation gotcha (this session, not a code issue)**: Running `npx playwright test <file>` without `--config=e2e/playwright.config.ts` from `frontend/` caused Playwright's config auto-discovery to skip the `setup` project's dependency resolution, producing spurious "Cannot navigate to invalid URL" / missing-storageState failures across the whole spec file. Re-running with `--config` explicit passed 18/19 (1 unrelated pre-existing flaky test, confirmed passing on isolated retry) — this was an invocation artifact of this debugging session, not a regression in the plan's code.
- **Flaky live test**: `"clicking regenerate button triggers instructions preview"` (pre-existing, unrelated to this plan) failed once in a full-suite run and passed cleanly on isolated retry — consistent with timing flakiness, not a regression.
- **Unrelated pre-existing test failure** (logged to `deferred-items.md`, not fixed per scope-boundary rule): `login.test.tsx > LoginPage > navigates user to /user/dashboard on login success` fails on the full `npx vitest run` pass (`/` vs `/user/dashboard`). `login.tsx`/`login.test.tsx` were never touched by this plan; the mismatch appears related to a concurrent Phase 36 post-login-landing change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `AvatarCharacterGallery` is ready for Plan 38-03 (persona-editor parity) to consume directly, with no further extraction work needed
- `voice-constants.ts`'s shared locale exports (`SUPPORTED_VOICE_LOCALES`/`LOCALE_FLAGS`/`LOCALE_LABEL_KEY`) are ready for persona-editor.tsx to switch to in Plan 38-03
- No blockers. The `login.test.tsx` failure (pre-existing, unrelated) remains open and tracked in `deferred-items.md` for whichever phase owns the Phase 36 post-login redirect logic

## Final Verification Results
- `cd frontend && npx tsc -b` — clean
- `cd frontend && npm run build` — passes (pre-existing large-chunk warning only, unrelated to this plan)
- `cd frontend && npx vitest run` — 2675/2676 passed; 1 pre-existing unrelated failure (`login.test.tsx`), logged not fixed
- `cd frontend && npx playwright test --config=e2e/playwright.config.ts hcp-editor-voice-tab.spec.ts` — 18/19 passed; 1 unrelated pre-existing flaky test confirmed passing on isolated retry (effectively 19/19)
- `cd backend && pytest -k hcp_profile` — 89/89 passed

---
*Phase: 38-voice-mode-config-foundry-portal*
*Completed: 2026-08-04*
