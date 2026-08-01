---
phase: 34-spanish-es-i18n
plan: 07
subsystem: api
tags: [pydantic, i18next, fastapi, tanstack-query, locale-forwarding]

# Dependency graph
requires:
  - phase: 34-spanish-es-i18n
    plan: 06
    provides: "WebrtcSessionRequest.locale 5-entry allowlist, DEFAULT_PUBLIC_VOICE_BY_LOCALE fallback, REFUSAL_TEMPLATES covering all 5 locales"
provides:
  - "ChatRequest.locale field (5-entry closed allowlist, default zh-CN) forwarded end-to-end to handle_anonymous_turn"
  - "Anonymous text-chat refusal/answer text now tracks the active UI locale for all 5 locales instead of always defaulting to zh-CN"
  - "sendAnonymousChat(sessionToken, message, locale) API client signature; useAnonymousAvatarChat resolves i18n.language internally via useTranslation()"
affects:
  - "34-10 (es-* voice E2E gate — LANG-02 closes only after that plan's gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale resolved internally inside a chat mutation hook via useTranslation() rather than threaded through mutate()'s variable type -- mirrors use-personalized-avatar-chat.ts precedent, keeps a shared UseMutationResult<_, Error, string> union call-site (avatar-page.tsx's chatMutation) type-compatible across both anonymous and personalized hooks"

key-files:
  created: []
  modified:
    - backend/app/schemas/public_avatar.py
    - backend/app/api/public_avatar.py
    - backend/tests/test_public_avatar_api.py
    - frontend/src/api/public-avatar.ts
    - frontend/src/hooks/use-anonymous-avatar-chat.ts
    - frontend/src/api/__tests__/public-avatar.test.ts
    - frontend/src/hooks/use-anonymous-avatar-chat.test.ts

key-decisions:
  - "Deviated from the plan's literal frontend design (mutate({message, locale}) object shape) in favor of resolving i18n.language internally inside useAnonymousAvatarChat via useTranslation() -- the object-shape approach would have broken avatar-page.tsx's chatMutation union type (personalizedChatMutation | anonymousChatMutation), which both hooks share as a single UseMutationResult<_, Error, string> so the shared chatMutation.mutate(message, {...}) call site can stay hook-agnostic. This exactly mirrors the existing precedent in use-personalized-avatar-chat.ts."
  - "avatar-page.tsx required NO changes -- i18n.language already flows into the anonymous chat request via the hook's internal useTranslation() call, so the plan's anticipated avatar-page.tsx edit was unnecessary once the internal-resolution pattern was adopted"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-01
---

# Phase 34 Plan 07: Anonymous Chat Locale Forwarding Summary

**Closed the LANG-02 gap where anonymous text-chat always defaulted to zh-CN regardless of the active UI language: `ChatRequest.locale` now flows from `avatar-page.tsx`'s `i18n.language` through the API client and hook into `handle_anonymous_turn`, so es-ES/es-MX/es-US refusal and grounded answers now match the switcher's selection.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-01
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `ChatRequest.locale` added (Pydantic `Field(pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$")`, default `zh-CN`) — matches `WebrtcSessionRequest`'s existing convention (T-34-09 mitigated: closed allowlist, fr-FR rejected with 422)
- `/public/avatar/chat` now calls `handle_anonymous_turn(..., locale=body.locale)` — the service function's existing `locale` kwarg (already present since Phase 32/34-06) is finally wired from the request
- Backend API tests (3 new cases): es-MX locale forwards and its `REFUSAL_TEMPLATES` string comes back verbatim; omitting `locale` still 200s with the zh-CN default (backward compatible); `fr-FR` 422s
- `sendAnonymousChat` gained a required `locale: string` third parameter, included in the POST body verbatim (snake_case wire format, matching backend schema)
- `useAnonymousAvatarChat` resolves `i18n.language` internally via `useTranslation()` (mirrors `use-personalized-avatar-chat.ts`'s established pattern) — `mutate(message: string)` signature is unchanged, so `avatar-page.tsx`'s `chatMutation = isAuthenticated ? personalizedChatMutation : anonymousChatMutation` union stays a single compatible type and required zero changes to that file
- Frontend unit tests updated at both layers (API client body-shape assertion, hook mock-locale assertion) — all passing
- Full verification suite green: `pytest tests/test_public_avatar_api.py -v` (16 passed), `vitest run src/api/__tests__/public-avatar.test.ts src/hooks/use-anonymous-avatar-chat.test.ts` (12 passed), `npx tsc -b` (no errors), `npm run build` (succeeds), `ruff check .` + `ruff format --check .` clean, `npx vitest run src/pages/avatar-page.test.tsx` (27 passed, confirms the unchanged call site still works)

## Task Commits

1. **Task 1: Backend — add ChatRequest.locale and forward it to handle_anonymous_turn** — `0f3db09` (feat)
2. **Task 2: Frontend — thread i18n.language through the anonymous chat call chain** — `9c0cc6e` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `backend/app/schemas/public_avatar.py` — `ChatRequest.locale` field added
- `backend/app/api/public_avatar.py` — `chat()` endpoint forwards `locale=body.locale`
- `backend/tests/test_public_avatar_api.py` — `TestChatEndpointLocale` (3 new tests)
- `frontend/src/api/public-avatar.ts` — `sendAnonymousChat` gains required `locale` param
- `frontend/src/hooks/use-anonymous-avatar-chat.ts` — resolves `i18n.language` internally via `useTranslation()`
- `frontend/src/api/__tests__/public-avatar.test.ts` — updated `sendAnonymousChat` call-site assertions
- `frontend/src/hooks/use-anonymous-avatar-chat.test.ts` — mocks `react-i18next`, asserts locale forwarding

## Decisions Made
- See `key-decisions` in frontmatter — the frontend hook design deviated from the plan's literal object-shaped `mutate()` signature to preserve type compatibility with the shared `chatMutation` union in `avatar-page.tsx`, following the exact precedent already established by `use-personalized-avatar-chat.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adopted internal-resolution locale pattern instead of the plan's literal object-shaped mutate() signature**
- **Found during:** Task 2 (frontend locale threading)
- **Issue:** The plan's interfaces block proposed changing `useAnonymousAvatarChat`'s `mutate()` variable type from `string` to `{message, locale}` and updating `avatar-page.tsx`'s call site accordingly. But `avatar-page.tsx` selects between `personalizedChatMutation` and `anonymousChatMutation` via `chatMutation = isAuthenticated ? ... : ...` and calls `chatMutation.mutate(message, {...})` on the resulting union — both hooks must share an identical `UseMutationResult<_, Error, string>` shape for this to type-check. `usePersonalizedAvatarChat` (added in Phase 33) already resolves `i18n.language` internally via `useTranslation()` rather than accepting it as a mutate argument. Following the plan literally would have broken this shared call site (`npx tsc -b` type error) or required an unplanned, more invasive change to branch the call site by hook type.
- **Fix:** Mirrored `use-personalized-avatar-chat.ts`'s exact pattern in `useAnonymousAvatarChat` — call `useTranslation()` inside the hook, pass `i18n.language` as the new third argument to `sendAnonymousChat` directly from the `mutationFn` closure. `mutate(message: string)` is unchanged; `avatar-page.tsx` required no edits at all.
- **Files modified:** `frontend/src/hooks/use-anonymous-avatar-chat.ts`, `frontend/src/hooks/use-anonymous-avatar-chat.test.ts`
- **Verification:** `npx tsc -b` clean; `npx vitest run src/pages/avatar-page.test.tsx` (27/27 passing, unchanged call site); `npx vitest run src/hooks/use-anonymous-avatar-chat.test.ts` asserts `sendAnonymousChat` receives the mocked `i18n.language` value
- **Committed in:** `9c0cc6e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The net effect (locale reaches the backend) is identical to the plan's intent; the implementation path changed to avoid a type-compatibility break at an existing shared call site and to follow established codebase precedent. No scope creep — `avatar-page.tsx` was in the plan's anticipated file list but ended up needing zero changes.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Anonymous text-chat locale forwarding is now complete end-to-end for all 5 locales; combined with 34-06's voice/refusal-template work, both the spoken (voice) and text response paths for anonymous avatar Q&A now honor the active UI locale.
- LANG-02 remains open per plan directive — it closes only after 34-10's E2E gate (real es-* voice verification). 34-08/34-09 (admin voice_map API + UI) are the next waves.

---
*Phase: 34-spanish-es-i18n*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 8 created/modified files confirmed present on disk; both task commit hashes (`0f3db09`, `9c0cc6e`) confirmed present in `git log`.
