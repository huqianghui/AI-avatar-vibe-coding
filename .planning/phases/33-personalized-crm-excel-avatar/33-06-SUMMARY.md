---
phase: 33-personalized-crm-excel-avatar
plan: 06
subsystem: ui
tags: [react, typescript, tanstack-query, playwright, i18next, axios, avatar]

# Dependency graph
requires:
  - phase: 33-04
    provides: "POST /avatar/session (IDOR-safe personalized session creation)"
  - phase: 33-05
    provides: "POST /avatar/chat (IDOR-gated personalized chat turn, PersonalizedChatResponse{answer,citations,is_refusal})"
provides:
  - "Auth-aware AvatarPage: isAuthenticated branches chat/session hooks between anonymous and personalized pipelines"
  - "usePersonalizedAvatarSession()/usePersonalizedAvatarChat() hooks + personalized-avatar.ts API client"
  - "专属模式/Personalized badge + user.email header slot for logged-in visitors, replacing the 登录 button"
  - "AvatarPage now hydrates auth-store user via useMe() on mount (fixes prior public-route gap)"
  - "Playwright E2E coverage (frontend/e2e/personalized-avatar-qa.spec.ts) proving PERS-02 end-to-end"
affects: [33-07, 33-08, avatar-frontend, personalized-avatar-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interchangeable chat-hook contract: usePersonalizedAvatarChat(sessionId) returns the same {mutate(message), isPending} shape as useAnonymousAvatarChat, so AvatarPage swaps `chatMutation = isAuthenticated ? personalizedChatMutation : anonymousChatMutation` with zero call-site branching elsewhere"
    - "Both session/chat hook pairs (anonymous + personalized) are always called unconditionally per React's rules of hooks; only the *result* is selected conditionally"
    - "E2E specs mock all avatar network endpoints via page.route() rather than depending on live backend CRM/rate-limiter state (matches Phase 32's anonymous-avatar-qa.spec.ts convention)"

key-files:
  created:
    - frontend/src/api/personalized-avatar.ts
    - frontend/src/api/personalized-avatar.test.ts
    - frontend/src/hooks/use-personalized-avatar-session.ts
    - frontend/src/hooks/use-personalized-avatar-session.test.ts
    - frontend/src/hooks/use-personalized-avatar-chat.ts
    - frontend/src/hooks/use-personalized-avatar-chat.test.tsx
    - frontend/e2e/personalized-avatar-qa.spec.ts
  modified:
    - frontend/src/pages/avatar-page.tsx
    - frontend/src/pages/avatar-page.test.tsx
    - frontend/public/locales/zh-CN/avatar.json
    - frontend/public/locales/en-US/avatar.json

key-decisions:
  - "Reused the real CitationOut{title,url,page} type from @/api/public-avatar instead of the plan doc's simplified {title,url} shape, matching the actual shared backend schema"
  - "usePersonalizedAvatarChat's mutate() takes a plain string (locale resolved internally via i18n.language), matching useAnonymousAvatarChat's signature so both hooks are interchangeable in AvatarPage without per-branch call-site differences"
  - "Voice/WebRTC (useAnonymousVoiceLive) stays wired unconditionally to the ANONYMOUS session token regardless of auth state, per D-13 -- zero new voice code for personalized mode"
  - "Fixed a hydration gap (Rule 1): AvatarPage now calls useMe() so a logged-in visitor's user.email is available for the personalization badge even on a hard page reload, since this public route was previously never covered by ProtectedRoute's own useMe() hydration"
  - "E2E spec mocks all avatar/session/chat/webrtc endpoints via page.route() rather than depending on the real backend's Excel-based CRM mapping fixture, following the existing anonymous-avatar-qa.spec.ts convention"

patterns-established:
  - "Auth-aware page composition: call every mode's hooks unconditionally, select the active result via isAuthenticated, keep unrelated subsystems (voice) pinned to whichever session powers them regardless of auth state"

requirements-completed: [PERS-02]

# Metrics
duration: ~70min
completed: 2026-08-01
---

# Phase 33 Plan 06: Auth-Aware Avatar Page + Personalized Chat Routing Summary

**AvatarPage now branches its chat/session hooks on `useAuthStore().isAuthenticated`, swapping the header's "登录" button for a "专属模式" badge + user email and routing chat through the JWT-authenticated personalized pipeline -- with zero new voice code and a structural guarantee that no CRM field ever reaches the DOM.**

## Performance

- **Duration:** ~70 min (commit span 20:18–21:28 CST, 2026-08-01)
- **Tasks:** 3 (+ 1 auto-fixed deviation)
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments
- Typed `personalized-avatar.ts` API client + `usePersonalizedAvatarSession`/`usePersonalizedAvatarChat` hooks, unit-tested with 100% coverage of their branching logic (session held in React state only, never persisted; chat mutation raises when no session exists yet).
- `AvatarPage` composes both the anonymous and personalized session/chat hook pairs unconditionally (rules of hooks) and selects the active `chatMutation` via `isAuthenticated`, while `useAnonymousVoiceLive` stays pinned to the anonymous session token for both auth states (D-13).
- Header right-hand slot swaps between the "登录" button (logged out) and a `Badge` ("专属模式"/"Personalized") + `user.email` (logged in), with no CRM/preference/match-status content ever read or rendered.
- Fixed a real hydration gap discovered while writing the E2E test: `AvatarPage` now calls `useMe()` so `user.email` is populated even on a hard page reload of this public (non-`ProtectedRoute`) route.
- `frontend/e2e/personalized-avatar-qa.spec.ts` proves the full flow against the real dev backend+frontend stack: badge+reply for a logged-in seeded user, structural no-CRM-leak guard, and a logged-out regression guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Personalized avatar API client + session/chat hooks** - `20d5aaa` (test+feat)
2. **Task 2: Auth-aware avatar page routing + personalization badge** - `81ef065` (feat)
3. *(Deviation, Rule 1)* **Hydrate auth-store user on avatar page reload** - `cbada39` (fix)
4. **Task 3: Playwright E2E coverage for personalized avatar Q&A** - `38e47c6` (test)

_Note: Task 1 was committed in the prior session turn (before a context-window summary/continuation); Tasks 2–3 and the Rule 1 fix were completed in this continuation._

## Files Created/Modified
- `frontend/src/api/personalized-avatar.ts` - `createPersonalizedSession()`, `sendPersonalizedChat()` via shared `apiClient`, re-exports real `CitationOut`
- `frontend/src/api/personalized-avatar.test.ts` - 2 tests covering both API calls
- `frontend/src/hooks/use-personalized-avatar-session.ts` - session held in React state only, `renewSession()` for manual retry
- `frontend/src/hooks/use-personalized-avatar-session.test.ts` - 3 tests: mount-creates-once, never persists to localStorage, surfaces creation errors
- `frontend/src/hooks/use-personalized-avatar-chat.ts` - `useMutation` wrapper, locale resolved via `i18n.language` internally
- `frontend/src/hooks/use-personalized-avatar-chat.test.tsx` - 3 tests: mutationFn call/resolve, raw error propagation, no-session guard
- `frontend/src/pages/avatar-page.tsx` - auth-aware hook branching, header badge/email, `useMe()` hydration fix
- `frontend/src/pages/avatar-page.test.tsx` - +5 tests (authenticated badge/email, personalized-routing, no-CRM-leak, unconditional voice-connect, logged-out regression guard) + `useMe()`/auth-store/personalized-hook mocks
- `frontend/public/locales/{zh-CN,en-US}/avatar.json` - added `personalizationBadge` key
- `frontend/e2e/personalized-avatar-qa.spec.ts` - 3 E2E scenarios (see Accomplishments)

## Decisions Made
See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hydrate auth-store `user` on `AvatarPage` reload**
- **Found during:** Task 3 (writing the Playwright E2E spec)
- **Issue:** `AvatarPage` is a public route (not `ProtectedRoute`-wrapped). On a hard page load, the in-memory auth store hydrates `token` from `localStorage` but leaves `user` as `null` until something fetches `/auth/me` -- previously only `auth-guard.tsx`'s `ProtectedRoute` gate did that. Since Task 2 made `AvatarPage` the first public page to render `user.email`, a logged-in visitor's fresh load of `/` would incorrectly show the "登录" button (badge/email never render) because `user` stayed `null` despite `isAuthenticated` being `true`. This was invisible in Task 2's unit tests because they mock `useAuthStore` directly with a pre-populated `user`, bypassing the real hydration gap; it only surfaced when the real backend + real login flow were exercised end-to-end in Task 3.
- **Fix:** Call `useMe()` (existing hook from `@/hooks/use-auth`) in `AvatarPage`; it hydrates the shared store via `setAuth()` inside its `queryFn` as a side effect. No-op when no token exists (`useMe`'s query is `enabled: !!token`).
- **Files modified:** `frontend/src/pages/avatar-page.tsx`, `frontend/src/pages/avatar-page.test.tsx` (added a hermetic `useMe()` stub to the existing full-hook-mock convention)
- **Verification:** All 27 tests in `avatar-page.test.tsx` and the full 2513-test frontend suite pass; `tsc -b` clean; confirmed end-to-end via the new Playwright spec (badge + `user1@aicoach.com` render correctly on a fresh `page.goto("/")` using real `storageState`-restored auth).
- **Committed in:** `cbada39`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness -- without it, PERS-02's core "logged-in user sees badge + email" success criterion would silently fail on any hard page load/reload. No scope creep; fix is scoped entirely to `avatar-page.tsx`'s own rendering concern.

## Issues Encountered

- The anonymous public-avatar routes are mounted bare (no `/api/v1` prefix, see `@/api/public-avatar.ts`'s own module docstring and the matching `/public` proxy entry in `vite.config.ts`), while the personalized routes go through the shared `apiClient` (`/api/v1` prefix). An initial draft of the E2E spec mocked all avatar endpoints under `**/api/v1/...`, causing the logged-out regression test's anonymous-chat mock to silently miss and the reply bubble to never render. Fixed by aligning the anonymous mocks' `page.route()` patterns to the bare `**/public/avatar/*` paths (matching `anonymous-avatar-qa.spec.ts`'s existing convention) while keeping the personalized mocks on `**/api/v1/avatar/*`. Verified via a full rerun: all 5 tests (2 setup + 3 spec) pass.
- The plan's own `<how-to-verify>` for the Task 2b checkpoint referenced running the Playwright spec created in Task 3 -- a forward reference across the checkpoint boundary. This was flagged in the checkpoint return and resolved naturally once Task 3 ran the spec here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PERS-02 is fully implemented and E2E-proven: logged-in users get a personalized, badge-marked chat experience; logged-out users retain the unmodified Phase 32 anonymous flow.
- `usePersonalizedAvatarChat`/`usePersonalizedAvatarSession` are ready for reuse by any future personalized-avatar UI work in this phase (e.g., citation-heavy replies, session-expiry UX).
- No blockers for subsequent 33-xx plans.

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 12 claimed files verified present on disk; all 4 claimed commits (`20d5aaa`, `81ef065`, `cbada39`, `38e47c6`) verified present in git history.
