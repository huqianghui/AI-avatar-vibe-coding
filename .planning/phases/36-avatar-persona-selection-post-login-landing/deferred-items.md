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
