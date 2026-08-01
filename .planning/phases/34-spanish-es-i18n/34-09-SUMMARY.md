---
phase: 34-spanish-es-i18n
plan: 09
subsystem: ui
tags: [react, typescript, tanstack-query, admin, voice-map, i18n]

# Dependency graph
requires:
  - phase: 34-spanish-es-i18n
    plan: 08
    provides: "GET/PUT /admin/public-knowledge-config/voice-map endpoints + admin.json voiceMap.* i18n keys across all 5 locales"
provides:
  - "frontend/src/types/public-knowledge-config.ts, frontend/src/api/public-knowledge-config.ts, frontend/src/hooks/use-voice-map.ts -- typed API client + TanStack Query hook for voice_map, mirroring the azure-config pattern"
  - "settings.tsx 'Voice per Language' Card: 5 flag+label rows (zh-CN/en-US/es-ES/es-MX/es-US), editable Input with default-voice placeholder, Save button that sends the full 5-locale dict"
affects:
  - "34-10 (LANG-02 closing gate -- es-* voice session E2E; this plan's admin UI is the last piece D-06 needed before that gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useVoiceMap()/useUpdateVoiceMap() TanStack Query hooks mirror use-azure-config.ts's useAIFoundryConfig/useUpdateAIFoundry pattern exactly (queryKey array, invalidateQueries onSuccess)"
    - "Local component state (voiceMapValues) seeded from query data via useEffect, always sent in full on Save -- avoids partial-diff PUT semantics mismatch with the backend's full-dict-replace contract"

key-files:
  created:
    - frontend/src/types/public-knowledge-config.ts
    - frontend/src/api/public-knowledge-config.ts
    - frontend/src/hooks/use-voice-map.ts
  modified:
    - frontend/src/pages/admin/settings.tsx
    - frontend/src/pages/admin/settings.test.tsx

key-decisions:
  - "Placed the new Card immediately after the existing 'Language Settings' Card in settings.tsx, per the plan's literal action text"
  - "voiceMapValues state initialized via useEffect keyed on voiceMapQuery.data (not a lazy useState initializer) since TanStack Query data arrives asynchronously after first render"
  - "No success toast on save (admin.json's voiceMap namespace only defines an 'error' key, no 'saved' key) -- matches 34-08's exact i18n key set rather than inventing a new key"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-02
---

# Phase 34 Plan 09: Admin Voice-Map Frontend UI Summary

**"Voice per Language" admin Card wired end-to-end to the 34-08 backend API -- 5 editable per-locale voice Inputs with default-voice placeholders and a full-dict Save mutation, closing out D-06's admin-editable requirement.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-02
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Created `types/public-knowledge-config.ts`, `api/public-knowledge-config.ts`, `hooks/use-voice-map.ts` mirroring the existing `azure-config` type/API/hook trio exactly (confirmed against `use-azure-config.ts` and `azure-config.ts` line-by-line before writing)
- Added a new "Voice per Language" `Card` to `settings.tsx` (placed after the "Language Settings" Card): `Languages` icon title, 5 rows in switcher order (zh-CN/en-US/es-ES/es-MX/es-US) each with a flag+label `Label` and a controlled `Input` whose placeholder is that locale's built-in default voice from the GET response's `defaults` map
- `voiceMapValues` state seeded from the query's `voice_map` via `useEffect`, guaranteeing the Save button always PUTs the complete 5-locale dict (edited row's new value + every other row's current/previous value) -- matching the backend's full-dict-replace PUT semantics documented in 34-08
- Save button shows `common:saving` text and is `disabled` while `updateVoiceMapMutation.isPending`; `onError` shows `admin:voiceMap.error` via `sonner`'s `toast.error`
- TDD: wrote 5 failing tests first (RED, confirmed against the pre-existing 11 tests staying green), then implemented the Card (GREEN) -- all 16 `settings.test.tsx` tests pass
- Full regression: `npx vitest run src/pages/admin/ src/i18n/` -- 22 files, 407 tests, all passing (includes the 65-test `locale-parity.test.ts` suite, untouched since no new i18n keys were added -- 34-08 already shipped `voiceMap.*` across all 5 locales)
- `npx tsc -b` clean; `npm run build` succeeds

## Task Commits

1. **Task 1: Create types, API client, and TanStack Query hook for voice_map** - `92a48bb` (feat)
2. **Task 2: Add the "Voice per Language" Card to settings.tsx** - `d91e8ee` (feat, includes TDD test + implementation in one commit per project convention of atomic task commits)

**Plan metadata:** (this commit)

## Files Created/Modified
- `frontend/src/types/public-knowledge-config.ts` - `VoiceMapResponse`/`VoiceMapUpdate` interfaces
- `frontend/src/api/public-knowledge-config.ts` - `getVoiceMap`/`updateVoiceMap` calling the 34-08 admin endpoint via `apiClient`
- `frontend/src/hooks/use-voice-map.ts` - `useVoiceMap()` query + `useUpdateVoiceMap()` mutation
- `frontend/src/pages/admin/settings.tsx` - new "Voice per Language" `Card` with `VOICE_MAP_LOCALES`/`FLAGS`/`LOCALE_LABEL_KEY` module constants, `voiceMapValues` state, `handleSaveVoiceMap`
- `frontend/src/pages/admin/settings.test.tsx` - 5 new tests (row/label/input render, placeholder-equals-default, full-dict save payload, error toast, pending-disabled Save button) + `sonner` mock + `@/hooks/use-voice-map` mock

## Decisions Made
See `key-decisions` in frontmatter. No architectural deviations -- implementation matches the plan's literal `<interfaces>` and `<action>` code snippets almost verbatim, confirmed against the real `azure-config.ts`/`use-azure-config.ts`/`language-switcher.tsx` files before finalizing (flags, label keys, i18n keys all pre-existed from 34-08/34-01 and required no new additions).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 34-10 (LANG-02 closing gate) can now exercise the full admin voice_map override path end-to-end (UI save -> backend PUT -> avatar session voice resolution) alongside the built-in default fallback.
- LANG-02 remains open per plan directive -- it closes only after 34-10's E2E gate. REQUIREMENTS.md was intentionally NOT updated for LANG-02 in this plan.

---
*Phase: 34-spanish-es-i18n*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk; both task commit hashes (`92a48bb`, `d91e8ee`) confirmed present in `git log`.
