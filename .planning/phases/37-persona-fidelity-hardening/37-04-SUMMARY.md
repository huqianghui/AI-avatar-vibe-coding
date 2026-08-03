---
phase: 37-persona-fidelity-hardening
plan: 04
subsystem: ui
tags: [react, typescript, webrtc, playwright, vitest]

# Dependency graph
requires:
  - phase: 37-02
    provides: "character/style fields on WebRTCSessionResponse + avatar session_config wiring in the public WebRTC endpoint"
provides:
  - "useAnonymousVoiceLive negotiates a receive-only video transceiver and surfaces avatarCharacter/avatarStyle/isAvatarConnected"
  - "avatar-page.tsx renders the active persona's identity via AvatarView's isDigitalHumanMode=true path (real video or static-preview/fallback)"
  - "E2E proof that persona switching updates the displayed avatar identity, not just the switcher trigger label"
affects: [anonymous-avatar-landing-page, persona-switching]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recvonly video transceiver negotiated unconditionally on every connect(); ontrack video branch mirrors use-avatar-stream.ts's proven attach-to-videoRef pattern"
    - "avatarCharacter/avatarStyle intentionally NOT reset on disconnect (persist through reconnect gap) while isAvatarConnected IS reset, avoiding a visual flash to audio-orb mid persona-switch"

key-files:
  created: []
  modified:
    - frontend/src/api/public-avatar.ts
    - frontend/src/hooks/use-anonymous-voice-live.ts
    - frontend/src/hooks/use-anonymous-voice-live.test.ts
    - frontend/src/pages/avatar-page.tsx
    - frontend/e2e/persona-switch.spec.ts
    - frontend/e2e/anonymous-avatar-voice.spec.ts
    - frontend/e2e/anonymous-avatar-voice-es.spec.ts

key-decisions:
  - "Kept FakeRTCPeerConnection's addTransceiver as a bare no-op across all 3 E2E specs -- no test needs to assert on it, it exists purely so the real hook code path doesn't throw against the fake transport (Rule 3 blocking fix)"
  - "mockWebrtcSessionSuccess in persona-switch.spec.ts now resolves character/style/greeting from the POST body's persona_id (mirroring mockPersonaSelection's existing pattern) instead of a hardcoded Harry-only response, so the initial-mount connect (no personaId) and the post-switch reconnect (personaId=HARRY.id) each get their own persona's identity"

requirements-completed: [PERSONA-05]

# Metrics
duration: ~35min
completed: 2026-08-03
---

# Phase 37 Plan 04: Persona video fidelity (frontend) Summary

**Anonymous WebRTC hook now negotiates a recvonly video transceiver and surfaces persona identity; the public landing page always displays the active persona (real avatar video if Azure streams one, static-preview/fallback identity otherwise), proven end-to-end by an E2E assertion that the avatar identity display flips Lisa->Harry on persona switch.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-03
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments
- `useAnonymousVoiceLive` calls `pc.addTransceiver("video", { direction: "recvonly" })` on every `connect()`, and its `ontrack` handler now branches on `event.track.kind === "video"` (mirroring `use-avatar-stream.ts`'s proven pattern) to attach any real avatar video track to the caller's `videoRef` and set `isAvatarConnected`
- The hook returns `avatarCharacter`/`avatarStyle` (sourced from the resolved `WebrtcSessionResponse.character`/`.style`, additive to 37-02's backend contract) and `isAvatarConnected` (additive, all pre-existing return keys unchanged)
- `avatar-page.tsx` passes `videoRef` into the hook and wires `AvatarView` with `isDigitalHumanMode={true}`, `isAvatarConnected={voiceLive.isAvatarConnected}`, `avatarCharacter`/`avatarStyle={voiceLive.avatarCharacter/avatarStyle}` -- the landing page now always shows the active persona's identity instead of the previous hardcoded `isDigitalHumanMode={false}` audio-orb-only state
- `persona-switch.spec.ts` proves the avatar identity display (not just the switcher trigger label) genuinely changes from "Lisa" to "Harry" on switch, via an assertion on the `data-testid="avatar-video"` element's parent container
- `anonymous-avatar-voice.spec.ts`/`-es.spec.ts` updated to reflect the now-correct behavior: with a known persona identity, `AvatarView` renders the static-preview layer instead of the audio orb post-connect

## Task Commits

1. **Task 1: Video transceiver negotiation + persona identity surfacing in useAnonymousVoiceLive** - `1cfe915` (feat)
2. **Task 2: Wire avatar-page.tsx to real persona identity + E2E proof of avatar-identity switch** - `aa2e437` (feat)

_No TDD tasks marked `tdd="true"` in this plan; Task 1 nonetheless followed a test-first shape (new vitest cases added alongside the hook change and verified together)._

## Files Created/Modified
- `frontend/src/api/public-avatar.ts` - added `character?`/`style?` to `WebrtcSessionResponse`
- `frontend/src/hooks/use-anonymous-voice-live.ts` - `videoRef` option, video transceiver negotiation, video `ontrack` branch, `avatarCharacter`/`avatarStyle`/`isAvatarConnected` state + return keys
- `frontend/src/hooks/use-anonymous-voice-live.test.ts` - `addTransceiver` mock, updated return-key-set assertion, 5 new test cases (video negotiation, videoRef attach, no-videoRef no-throw, character/style surfacing, disconnect reset)
- `frontend/src/pages/avatar-page.tsx` - `videoRef` passed into the hook; `AvatarView` now digital-human-mode-on with real hook-sourced identity/connection props; module docstring updated
- `frontend/e2e/persona-switch.spec.ts` - `mockWebrtcSessionSuccess` resolves persona identity from the request body; new Lisa/Harry avatar-identity-container assertions; `addTransceiver` no-op added to `FakeRTCPeerConnection`
- `frontend/e2e/anonymous-avatar-voice.spec.ts` - mock gains `character`/`style`; post-connect assertion moved from `audio-orb` to `avatar-static-preview`; `addTransceiver` no-op added
- `frontend/e2e/anonymous-avatar-voice-es.spec.ts` - same two changes as above, for the es-* locale variant

## Decisions Made
- `avatarCharacter`/`avatarStyle` persist through `disconnect()`/reconnect (not reset) while `isAvatarConnected` IS reset -- avoids the static-preview layer flashing to the audio-orb mid persona-switch, since the `isConnecting` skeleton already visually covers that gap (per plan's explicit behavior spec).
- `persona-switch.spec.ts`'s `mockWebrtcSessionSuccess` was extended (not just the E2E assertions) so the mocked backend response genuinely reflects whichever persona `connect()` resolved to, matching the already-proven `mockPersonaSelection` mutable-fixture convention in the same file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added no-op `addTransceiver()` to all 3 E2E specs' `FakeRTCPeerConnection`**
- **Found during:** Task 2 Playwright verification
- **Issue:** `useAnonymousVoiceLive`'s `connect()` now unconditionally calls `pc.addTransceiver(...)`. The E2E specs' hand-rolled `FakeRTCPeerConnection` classes (in `persona-switch.spec.ts`, `anonymous-avatar-voice.spec.ts`, `anonymous-avatar-voice-es.spec.ts`) did not implement this method, which would throw a `TypeError` and fail every WebRTC-connect-path test in those files.
- **Fix:** Added a bare no-op `addTransceiver(): void {}` method to each spec's `FakeRTCPeerConnection` class.
- **Files modified:** the same 3 E2E spec files already in this plan's `files_modified` list.
- **Verification:** `npx playwright test e2e/persona-switch.spec.ts e2e/anonymous-avatar-voice.spec.ts e2e/anonymous-avatar-voice-es.spec.ts --config=e2e/playwright.config.ts` -- 9/9 passed.
- **Committed in:** `aa2e437` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue, Rule 3)
**Impact on plan:** Mechanically necessary consequence of Task 1's hook change; no scope creep -- confined to the exact 3 spec files the plan already listed.

## Issues Encountered
Two pre-existing, unrelated vitest failures surfaced during the full-suite run (`login.test.tsx`, `auth-guard.test.tsx`, both asserting a stale `/user/dashboard` redirect target superseded by Phase 36's `/` landing-page decision). Neither file is in this plan's scope; logged to `deferred-items.md` per the scope-boundary rule rather than fixed here.

## User Setup Required
None - no external service configuration required. The residual live-Azure video-negotiation risk (flagged in 37-02) remains unresolved by design: this plan makes the client capable of receiving avatar video if Azure sends it, but does not itself prove Azure sends it for this transport/session type.

## Next Phase Readiness
- PERSONA-05 is now closed end-to-end: backend `character`/`style`/`instructions` session_config wiring (37-02) + frontend video-transceiver negotiation and persona-identity rendering (this plan).
- Phase 37 (persona-fidelity-hardening) is now 4/4 plans complete.
- Residual risk carried forward unresolved by design (documented in 37-02-SUMMARY.md and restated in this plan's threat model as accept/T-37-11): whether Azure Voice Live actually streams avatar video over this WebRTC-over-signaling-URL transport for agent-mode public sessions is still unverified against live Azure. If it never does, the static-preview/fallback layer (proven correct by this plan's E2E coverage) is the permanent, fully-functional visible state -- not a degraded one.

---
*Phase: 37-persona-fidelity-hardening*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 7 claimed modified files verified present on disk; both task commit hashes (`1cfe915`, `aa2e437`) verified present in git history.
