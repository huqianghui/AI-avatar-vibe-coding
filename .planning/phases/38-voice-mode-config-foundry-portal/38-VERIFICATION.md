---
phase: 38-voice-mode-config-foundry-portal
verified: 2026-08-04T06:20:44Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 38: Voice Mode Config (Foundry Portal Style) Verification Report

**Phase Goal:** Both the HCP profile editor and the persona editor configure the digital human via Foundry-portal-style direct voice mode settings (model deployment, language, speech-output voice, avatar toggle + character gallery) instead of selecting a pre-provisioned Voice Live instance; the HCP page's Voice Live Instance card is removed, the direct config is persisted, and voice sessions actually use it.

**Verified:** 2026-08-04T06:20:44Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HCP profile editor no longer shows a "Voice Live Instance" selector; in its place is Foundry-portal-style voice mode config (model deployment, language, speech-output voice, avatar toggle + character gallery) | ✓ VERIFIED | `frontend/src/components/admin/agent-config-left-panel.tsx` — no `useVoiceLiveInstances`/`vlInstanceEmptyTitle`/"Manage in Voice Live" markers remain (only a stale code comment at line 47 referencing the old field name, and a plan-authored comment at line 65 confirming removal). New card at line 69 (`t("admin:hcp.voiceAvatarConfigTitle")`) renders `VoiceLiveModelSelect` (line 77, model deployment), a Language `<Select>` bound to `recognition_language` (line 92), a Speech-output Voice `<Select>` bound to `voice_name` (line 117), an `avatar_enabled` `<Switch>` (line 140), and `<AvatarCharacterGallery>` (line 145). i18n key `hcp.voiceAvatarConfigTitle` present in all 5 locale files (`en-US`/`zh-CN`/`es-ES`/`es-MX`/`es-US` `admin.json` line 78). E2E test `hcp-editor-voice-tab.spec.ts:108` ("...visible with no Voice Live Instance selector (VMODE-01)") passing per 38-02-SUMMARY. |
| 2 | The HCP direct voice-mode config is persisted on the HCP profile (Alembic migration as needed) and HCP voice sessions use it — no dependency on a pre-provisioned Voice Live instance | ✓ VERIFIED | Migration `backend/alembic/versions/g40a_add_hcp_direct_voice_config.py` adds 6 columns (`voice_live_model`, `voice_name`, `recognition_language`, `avatar_character`, `avatar_style`, `avatar_enabled`) via `batch_alter_table`, with a correlated-subquery backfill `UPDATE` from any linked `voice_live_instances` row. `alembic history` confirms it is the head revision, chained correctly onto `f39a_persona_greeting_map_unique_default`. ORM columns mirrored in `backend/app/models/hcp_profile.py:47-52`. `resolve_voice_config()` (`backend/app/services/voice_live_instance_service.py:258-301`) reads all 6 keys exclusively from `profile.*` inline columns (no `profile.voice_live_instance` access anywhere in the function body) — confirmed by direct read of the function body. Both real callers verified wired: `voice_live_websocket.py:174-178` (`_load_connection_config`'s `hcp_profile_id` branch, `vc = resolve_voice_config(profile)`) and `agent_sync_service.py:145-147` (`build_voice_live_metadata`, `vc = resolve_voice_config(profile)`). Response-serialization gap (the Rule-1 bug found in 38-02, where `HcpProfileOut` silently dropped the 6 fields from every GET/PUT response) is fixed — `backend/app/api/hcp_profiles.py:43-57` now declares all 6 fields plus the vestigial `voice_live_instance_id`. Backend targeted tests re-run live: `pytest tests/test_hcp_profile_voice.py tests/test_voice_live_instance_service.py -q` → 42 passed. |
| 3 | The persona editor uses the same Foundry-portal-style voice mode config components/layout (speech output section, avatar gallery with character previews, language dropdown) | ✓ VERIFIED | `frontend/src/pages/admin/persona-editor.tsx:340` renders `<AvatarCharacterGallery>` (same shared component as the HCP editor, imported line 30) — no local `avatarFilter`/`filteredAvatarItems`/`failedThumbnailsRef`/`AvatarGridItem` duplication remains (all absent from a full-file grep). Locale constants imported from the shared `frontend/src/lib/voice-constants.ts` (`SUPPORTED_VOICE_LOCALES`/`LOCALE_FLAGS`/`LOCALE_LABEL_KEY`, lines 32-36), used for the Language dropdown (lines 366-431). `speechSectionTitle` value retitled to "Speech output" phrasing in all 5 locales (verified: en-US "Speech output", zh-CN "语音输出", es-ES/es-MX/es-US "Salida de voz" — `admin.json` line 762 each). Live re-run: `npx vitest run src/pages/admin/persona-editor.test.tsx src/components/admin/agent-config-left-panel.test.tsx src/components/admin/avatar-character-gallery.test.tsx` → 55/55 passed. |
| 4 | Existing HCP and persona voice sessions keep working end-to-end after the swap (no regression in avatar video/voice) | ✓ VERIFIED | `resolve_voice_config()` preserves its exact 21-key output dict shape (confirmed by direct read), so neither `voice_live_websocket.py` nor `agent_sync_service.py` required call-site changes. Backend migration backfills existing HCP profiles from their previously-linked instance rather than resetting to hardcoded defaults, protecting existing configured avatars. Persona session wiring (Phases 36/37) was not touched by Plan 38-03 (file list confined to `persona-editor.tsx`/test/locales/E2E — no service/API files). E2E `admin-avatar-personas.spec.ts` (390 lines) and `hcp-editor-voice-tab.spec.ts` (617 lines, 18 tests) cover the Playground/Instructions/tab-navigation paths alongside the new voice-mode assertions. Full suite results reported by the plan sessions (not independently re-run in full due to ~20min runtime): backend 2926/2926 passed (5 pre-existing flaky live-Azure tests excluded, logged in `deferred-items.md`); frontend vitest 2677/2678 (1 pre-existing unrelated `login.test.tsx` failure, logged, untouched by this phase); `tsc -b` clean; `ruff` clean. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/g40a_add_hcp_direct_voice_config.py` | 6-column migration + backfill, reversible | ✓ VERIFIED | Exists, head revision, batch-mode upgrade + backfill UPDATE + downgrade present |
| `backend/app/models/hcp_profile.py` | 6 new mapped columns | ✓ VERIFIED | Lines 47-52, matches migration defaults |
| `backend/app/schemas/hcp_profile.py` | Create/Update/Response expose 6 fields; instance optional | ✓ VERIFIED | `git diff` shows +39/-8 lines; fields present |
| `backend/app/services/voice_live_instance_service.py` | `resolve_voice_config()` reads inline columns only | ✓ VERIFIED | Function body (lines 258-301) reads exclusively `profile.*`; no `profile.voice_live_instance` reference |
| `backend/app/api/hcp_profiles.py` | `HcpProfileOut` exposes the 6 fields (Rule-1 fix) | ✓ VERIFIED | Lines 43-57 |
| `backend/tests/test_hcp_profile_voice.py` | pytest coverage | ✓ VERIFIED | Exists; re-run passed (part of 42/42) |
| `frontend/src/components/admin/avatar-character-gallery.tsx` | Shared filterable gallery component | ✓ VERIFIED | Exists, exports `AvatarCharacterGallery`, unit-tested (5/5 passing) |
| `frontend/src/components/admin/agent-config-left-panel.tsx` | VL Instance card removed; new config card added | ✓ VERIFIED | Confirmed via grep — old markers absent, new card present |
| `frontend/src/pages/admin/hcp-profile-editor.tsx` | Schema extended, VL instance optional | ✓ VERIFIED | Lines 82-87 (zod fields), 156-161 (defaults from profile) |
| `frontend/e2e/hcp-editor-voice-tab.spec.ts` | E2E for configure→save→reload persistence | ✓ VERIFIED | 617 lines, 18 tests including VMODE-01-tagged persistence test |
| `frontend/src/pages/admin/persona-editor.tsx` | Delegates to shared gallery, no local duplication | ✓ VERIFIED | Line 340 usage; dead state confirmed absent |
| `frontend/e2e/admin-avatar-personas.spec.ts` | E2E for shared gallery in persona editor | ✓ VERIFIED | 390 lines, present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `voice_live_websocket.py::_load_connection_config` (hcp_profile_id branch) | `voice_live_instance_service.py::resolve_voice_config` | `vc = resolve_voice_config(profile)` | ✓ WIRED | Confirmed at line 178 (and again line 496 in a second call site) |
| `agent_sync_service.py::build_voice_live_metadata` | `voice_live_instance_service.py::resolve_voice_config` | `vc = resolve_voice_config(profile)` | ✓ WIRED | Confirmed at line 147 |
| `agent-config-left-panel.tsx` | `avatar-character-gallery.tsx` | `<AvatarCharacterGallery .../>` | ✓ WIRED | gsd-tools automated check: verified |
| `hcp-profile-editor.tsx::handleSubmit` | Backend HcpProfileCreate/Update | `createMutation.mutate(data)` / `updateMutation.mutate({id, data})` | ✓ WIRED | Confirmed manually at lines 168-185; 6 new fields flow into `data` object before mutate calls |
| `persona-editor.tsx` | `avatar-character-gallery.tsx` | `<AvatarCharacterGallery .../>` | ✓ WIRED | gsd-tools automated check: verified |
| `persona-editor.tsx` | `voice-constants.ts` | `import {...} from "@/lib/voice-constants"` | ✓ WIRED | Confirmed manually at lines 32-36; `SUPPORTED_VOICE_LOCALES`/`LOCALE_FLAGS`/`LOCALE_LABEL_KEY` used throughout the file (lines 44, 90, 174, 366-431) |

Note: `gsd-tools verify key-links` reported 4/6 as automated "not found" because the `from`/`via` fields in plan frontmatter contain descriptive suffixes (e.g. `"...py::_load_connection_config (hcp_profile_id branch)"`) that the tool's path resolver can't parse, and one `via` field was empty. All 6 links were manually confirmed present and correctly wired by direct source inspection (see line references above) — these are tool false negatives, not real gaps.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| VMODE-01 | 38-01, 38-02 | HCP 档案编辑页 — 移除 Voice Live Instance 卡片，替换为 Foundry portal 风格直接配置，持久化并被语音会话实际使用 | ✓ SATISFIED | Migration + model + schema + `resolve_voice_config()` + UI card swap all verified above |
| VMODE-02 | 38-03 | Persona 编辑页对齐 — 共享组件/样式：Speech output、Avatar 画廊、Language 下拉 | ✓ SATISFIED | Shared `AvatarCharacterGallery` + `voice-constants.ts` + "Speech output" retitle all verified above |

No orphaned requirements — both REQUIREMENTS.md entries for Phase 38 (VMODE-01, VMODE-02) are claimed and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/admin/agent-config-left-panel.tsx` | 255-258 | `{/* Tools placeholder */}` + `hcp.toolsPlaceholder` string | ℹ️ Info | Pre-existing, out-of-scope decorative placeholder for the deferred PEDIT-01 Tools panel — not touched or introduced by this phase |
| `backend/app/services/voice_live_instance_service.py` | 100 | `# TODO: If HCP-per-instance count grows significantly, consider...` | ℹ️ Info | Pre-existing scaling note in an unrelated function, not a stub in the VMODE code path |
| `backend/app/services/voice_live_instance_service.py` | 274-300 | `resolve_voice_config()` hardcodes 15 of 21 output keys to fixed values | ℹ️ Info | Intentional per plan/context — these 15 fields (voice_temperature, turn_detection_type, etc.) are explicitly out of this phase's UI scope; documented in SUMMARY key-decisions, not a hidden stub |

No blocker or warning-level anti-patterns found in phase-scoped files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend targeted voice-config tests pass | `pytest tests/test_hcp_profile_voice.py tests/test_voice_live_instance_service.py -q` | 42 passed | ✓ PASS |
| Frontend targeted component/page tests pass | `npx vitest run src/pages/admin/persona-editor.test.tsx src/components/admin/agent-config-left-panel.test.tsx src/components/admin/avatar-character-gallery.test.tsx` | 55/55 passed | ✓ PASS |
| Alembic migration chain is head and well-formed | `alembic history` | `f39a... -> g40a... (head)` | ✓ PASS |
| `resolve_voice_config()` never reads `profile.voice_live_instance` | source inspection | confirmed absent | ✓ PASS |
| 5-locale i18n parity for both new/changed strings | `grep voiceAvatarConfigTitle` / `grep speechSectionTitle` across 5 locale files | all 5 present for both keys | ✓ PASS |

Full-suite backend (2926 tests, ~20min) and full-suite frontend vitest (2678 tests) were not independently re-run in this verification pass due to runtime cost; targeted re-runs above confirm the phase-specific code paths, and the SUMMARY-reported full-suite results (2926/2926 backend, 2677/2678 frontend with one pre-existing unrelated failure) are consistent with the targeted spot-checks and the absence of any new regressions found during code inspection.

### Human Verification Required

None. All success criteria are verifiable via code inspection, automated test re-runs, and E2E test presence/content review. No visual/UX judgment calls were needed beyond what the phase's own E2E suites already assert.

### Gaps Summary

No gaps found. All 4 roadmap success criteria are verified with direct evidence:
1. Voice Live Instance card removal + Foundry-portal-style replacement — confirmed in `agent-config-left-panel.tsx`.
2. Persistence + session usage — confirmed via migration, ORM columns, and `resolve_voice_config()`'s exclusive read from inline `HcpProfile` columns, wired into both real callers.
3. Persona editor parity — confirmed via shared `AvatarCharacterGallery` + `voice-constants.ts` + "Speech output" retitle.
4. No regression — `resolve_voice_config()`'s output shape preserved, backfill protects existing data, unrelated Phase 36/37 session wiring untouched, and both admin editors' targeted test suites pass live.

The one genuine implementation risk this phase surfaced (`HcpProfileOut` silently dropping the 6 new fields from API responses, which would have defeated the entire feature on page reload) was caught and fixed during Plan 38-02's own E2E testing (Rule-1 deviation) — verified fixed by direct inspection of `backend/app/api/hcp_profiles.py`.

---

*Verified: 2026-08-04T06:20:44Z*
*Verifier: Claude (gsd-verifier)*
