# Deferred Items — Phase 36 Plan 02

Out-of-scope failures discovered while running the Task 3 regression gate
(`e2e/voice-live-proxy.spec.ts`). Confirmed pre-existing and unrelated to
36-02's changes (admin sidebar/router/persona pages) — none of the touched
files (`admin-layout.tsx`, `router/index.tsx`, `persona-*`) affect the
voice-session pages, HCP seed data, or the Voice Live management page's
batch-resync control. Reproduced identically across multiple runs before
and after this plan's fixes.

1. `voice-live-proxy.spec.ts:176` — "F2F Unified Session binds the Voice
   Live first frame to session_id" — times out waiting for a real Azure
   Voice Live `session.update` frame within 15s. Depends on live Azure
   Voice Live credentials/connection timing, not on this plan's changes.
2. `voice-live-proxy.spec.ts:380` — "end session opens confirmation
   dialog" — `getByRole("button", { name: /continue|继续/i })` not found.
   Unrelated UI element in the voice/unified-session page.
3. `voice-live-proxy.spec.ts:519` — "Voice Live management page shows
   chain cards for HCP profiles" — expects an HCP profile named
   "Dr. Zhang Wei (张维)" to exist; missing from current seed/dev data.
4. `voice-live-proxy.spec.ts:536` — "batch re-sync button is present and
   clickable" — no button matching `/re-?sync|重新同步|batch/i` found on
   the Voice Live management page.

None of these block Phase 36 Plan 02's success criteria. The plan's own
regression guard — `voice-live-proxy.spec.ts:489` "admin sidebar shows
Voice Live link" — passes.

# Deferred Items — Phase 36 Plan 04

Out-of-scope failures discovered while running the Task 1 backend regression
gate (`cd backend && pytest -q`) after adding the self-service
selected-persona endpoint. Confirmed pre-existing and unrelated to 36-04's
changes (`schemas/user_preference.py`, `services/avatar_persona_service.py`,
`api/user_persona_selection.py`, `api/__init__.py`, `main.py`,
`tests/test_user_persona_selection_api.py`) — none of the failing test
files reference personas, user preferences, or the new endpoint.

1. `test_skill_consumption_service.py::TestMountSkillToolbox::test_typed_kwarg_raises_falls_back_to_raw_dict`
2. `test_skill_foundry_service.py` — 5 failures under `test_sync_skill_to_foundry_*`
   (first-sync unique name, success fields, exception handling, timeout
   handling, called-twice-same-name) — Foundry sync client behavior,
   unrelated to avatar personas.
3. `test_skill_text_extractor.py::TestExtractTextFromPdf` — 5 failures
   (multi-page, none-text pages, empty-text pages, open-raises, no-pages) —
   PDF extraction library behavior, unrelated to this plan.
4. `test_voice_live_websocket.py` — 11 failures under
   `TestRealAzureSessionConfig`/`TestRealVoiceLiveIntegration` — these
   exercise real Azure Voice Live session-config wiring (model mode, agent
   mode, transcription, credentials), unrelated to the persona-selection
   endpoint added by this plan.

Total: 22 pre-existing failures, 2862 passed, 15 skipped. All failures live
in files never touched by 36-04. `test_user_persona_selection_api.py` (8/8),
`test_avatar_persona_service.py`, and every other persona/preference test
pass cleanly.
