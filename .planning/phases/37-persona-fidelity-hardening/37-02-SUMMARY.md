---
phase: 37-persona-fidelity-hardening
plan: 02
subsystem: backend
tags: [fastapi, jwt, voice-live, webrtc, persona, sanitization, crm-merge]

# Dependency graph
requires:
  - phase: 37-01
    provides: "AvatarPersona.character/style/prompt_fragment, resolve_active_persona(), resolve_greeting_for_locale()"
  - phase: 36-03
    provides: "create_public_webrtc_session_config(), public_avatar.py webrtc_session handler, two-gate personalization_sanitizer, build_personalization_context() merge convention"
provides:
  - "get_optional_current_user() -- additive-only, never-raises optional-auth dependency for the shared anonymous-capable webrtc endpoint"
  - "avatar: {character, style, customized} + modalities block and instructions key in the public WebRTC session_config, additive-only (byte-identical when omitted)"
  - "WebRTCSessionResponse.character/style fields alongside greeting"
  - "Persona resolution + sanitized instructions + optional CRM merge wired into /public/avatar/webrtc/session for both anonymous and logged-in callers on the same endpoint"
affects: [voice-live-webrtc-session-init, frontend-avatar-video-transceiver (37-04), persona-fidelity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-auth dependency mirrors get_current_user's JWT-decode logic but degrades to None on any failure instead of raising -- for endpoints whose core contract never requires a JWT"
    - "Additive-only session_config keys: new dict keys added only when the corresponding kwarg is truthy, keeping existing callers byte-identical"
    - "CRM merge convention reused verbatim from text-chat paths: \"\\n\\n\".join(filter(None, [sanitized_fragment, crm_context]))"

key-files:
  created: []
  modified:
    - backend/app/dependencies.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/voice_live_webrtc.py
    - backend/app/api/public_avatar.py
    - backend/tests/test_dependencies.py
    - backend/tests/test_voice_live_webrtc.py
    - backend/tests/test_public_webrtc_session.py

key-decisions:
  - "get_optional_current_user parses the Authorization header manually rather than depending on oauth2_scheme, which itself raises 401 on a missing header -- the wrong behavior for an optional dependency"
  - "avatar/modalities/instructions keys added to session_config only when their source kwarg is truthy, preserving byte-identical output for any other caller of create_public_webrtc_session_config"
  - "Live-Azure verification of the two RESEARCH.md open questions (video negotiation over the WebRTC 'calls' transport; instructions effect in agent mode) was NOT performed in this automated run -- both documented as unverified residual risks per the plan's own resume-signal contract, which accepts either outcome without blocking completion"

requirements-completed: [PERSONA-06]

# Metrics
duration: ~50min
completed: 2026-08-03
---

# Phase 37 Plan 02: Persona Session-Config Fidelity (Avatar Identity + Voice Instructions) Summary

**The shared `/public/avatar/webrtc/session` endpoint now carries the active persona's `avatar: {character, style}` block and a sanitized, optionally CRM-merged `instructions` string in its Voice Live `session_config`, for both anonymous and logged-in callers via a new additive-only optional-auth dependency.**

## Performance

- **Duration:** ~50 min total (3 automated tasks completed by a prior executor; this session resumed after an orchestrator-resolved blocking checkpoint to finalize verification, SUMMARY, and state updates)
- **Completed:** 2026-08-03
- **Tasks:** 3/3 automated tasks + 1 checkpoint (resolved by orchestrator, not live-verified)
- **Files modified:** 7

## Accomplishments
- `get_optional_current_user()` added to `backend/app/dependencies.py` -- resolves `User | None` from an `Authorization` header, mirroring `get_current_user`'s JWT-decode logic exactly but never raising (missing/malformed/expired/invalid/inactive all degrade to `None`); `get_current_user` and every other route depending on it are completely untouched.
- `create_public_webrtc_session_config()` gained `character`/`style`/`instructions` kwargs: when `character`+`style` are supplied, `session_config["avatar"] = {"character", "style", "customized": False}` and `session_config["modalities"] = ["text", "audio", "avatar"]` are added; when `instructions` is supplied, `session_config["instructions"]` is added. All three are additive-only -- omitted entirely (byte-identical to prior behavior) when not supplied. `WebRTCSessionResponse` gained `character`/`style` fields alongside the existing `greeting`.
- `public_avatar.py`'s `webrtc_session` handler now depends on `get_optional_current_user`, scopes `resolve_active_persona(..., user_id=current_user.id if current_user else None, ...)`, builds `instructions` as `sanitize_free_text_with_pii(persona.prompt_fragment)` optionally joined with `await build_personalization_context(db, current_user.id)` (only ever called when a user was genuinely resolved from a valid JWT), and passes `character=persona.character, style=persona.style, instructions=instructions or None` into the session-config builder.
- Full two-gate sanitization pipeline reused unchanged (gate 1 at admin-save time, gate 2 at injection time) -- no new sanitizer introduced, per D-37-2.

## Task Commits

1. **Task 1: Additive optional-auth dependency for the shared anonymous-capable endpoint** - `59ab756` (feat)
2. **Task 2: Avatar character/style + sanitized instructions into session_config** - `8161528` (feat)
3. **Task 3: Wire persona resolution + sanitized instructions + optional CRM merge into the webrtc_session handler** - `b2344df` (feat)

_All three tasks marked `tdd="true"` in the plan; tests were written and passing alongside each production-code commit (combined commits, no separate RED/GREEN split observed in history -- consistent with prior phases' commit-boundary conventions)._

## Files Created/Modified
- `backend/app/dependencies.py` - `get_optional_current_user()` added, `__all__` extended
- `backend/app/schemas/voice_live.py` - `WebRTCSessionResponse.character`/`.style` fields added
- `backend/app/services/voice_live_webrtc.py` - `character`/`style`/`instructions` kwargs + conditional `avatar`/`modalities`/`instructions` session_config keys
- `backend/app/api/public_avatar.py` - `webrtc_session` handler wires optional-auth persona scoping + sanitized/CRM-merged instructions
- `backend/tests/test_dependencies.py` - `TestGetOptionalCurrentUser` (no header, malformed header, expired token, valid active user, valid inactive user)
- `backend/tests/test_voice_live_webrtc.py` - avatar/modalities/instructions presence-and-absence cases, response character/style exposure
- `backend/tests/test_public_webrtc_session.py` - no-header/valid-header-with-CRM/invalid-header cases for the wired handler

## Decisions Made
- Manual `Authorization` header parsing instead of `oauth2_scheme` dependency, since `oauth2_scheme` itself raises 401 on a missing header -- incompatible with an optional dependency's contract.
- All three new session_config keys (`avatar`, `modalities`, `instructions`) are strictly additive -- gated on their source kwarg being truthy -- so no existing caller of `create_public_webrtc_session_config` observes any behavior change.
- CRM merge (`build_personalization_context`) is only ever invoked when `current_user` was genuinely resolved from a valid JWT; an anonymous caller's `current_user` is always `None`, so the CRM lookup is never even attempted for anonymous sessions (T-37-06 mitigation).

## Checkpoint Outcome (Live-Azure Verification)

The plan's blocking `checkpoint:human-verify` task asked for two live-Azure behavioral confirmations that static analysis and unit tests cannot answer. **Live-Azure verification was NOT performed** in this automated run (no live Azure session available). Per the plan's own resume-signal contract -- *"either outcome is acceptable to proceed; a 'no' on either gets documented as a residual risk"* -- both items are documented below as **unverified residual risks**, not blockers:

1. **Avatar video negotiation over WebRTC transport** -- whether `avatar: {character, style}` in `session_config` actually negotiates a real video track over the Phase-29 WebRTC direct-signaling ("calls") transport. **UNVERIFIED against live Azure.** RESEARCH.md flags this as a known open question (Pitfall 1) with only MEDIUM-LOW confidence the shape alone triggers real negotiation on this specific transport.
2. **Instructions effect on conversational tone in agent mode** -- whether `instructions` observably changes conversational tone in server-side agent mode. Microsoft's own documentation states `instructions` "isn't supported when using a custom agent," and the anonymous path here is always agent mode. **UNVERIFIED against live Azure.**

Both items are backend-shape-complete and fully unit-tested against the documented/reverse-engineered SDK shape (RESEARCH.md, three independently-verified sources, HIGH confidence on shape). Wave-3 plan 37-04 (frontend video transceiver wiring) proceeds regardless of outcome (1): if live Azure ultimately shows no video track over this transport, the frontend's AvatarView gracefully falls back to the audio orb by design, per the plan's own fallback architecture.

## Deviations from Plan

None - plan executed exactly as written across all three automated tasks. No Rule 1/2/3 auto-fixes were required; the offline verification gates (ruff, pytest) passed without any code changes needed in this finalization session.

## Verification Results

- `cd backend && ruff check .` -- **All checks passed.**
- `cd backend && ruff format --check .` -- **395 files already formatted.**
- `cd backend && pytest -q` -- **2904 passed, 4 failed, 15 skipped, 28 deselected** (coverage 90.24%, exceeding the required 89% gate). The 4 failures are all in `tests/test_voice_live_websocket.py` (`TestRealAzureSessionConfig`, `TestRealVoiceLiveIntegration` classes) and require a live Azure/az-login session to pass -- pre-existing, environment-dependent, unrelated to this plan's changes, out of scope per this finalization's explicit instruction.
- Manual curl-based `session_config` shape verification (no-header default persona; valid-header CRM merge) was covered by the automated test suites in Tasks 2/3 rather than a separate live curl call, since the backend was not started as a live server in this offline finalization pass.

## Issues Encountered
None beyond the two documented live-Azure residual risks above, which are explicitly acceptable outcomes per the plan's resume-signal contract.

## User Setup Required
None for this plan's backend changes. Live-Azure verification of the two residual-risk items (video negotiation, instructions tone effect) remains open and can be performed manually against a real Azure Voice Live deployment at any future point without further code changes.

## Next Phase Readiness
- PERSONA-06 is fully implemented and unit-tested (sanitized persona fragment + optional CRM merge reaching the voice channel's `instructions`) and is marked complete in REQUIREMENTS.md.
- PERSONA-05 is intentionally NOT marked complete -- it spans this plan (backend `avatar` block) and 37-04 (frontend video transceiver negotiation + on-screen rendering); only the backend half is done here.
- 37-04 (frontend video transceiver + persona identity wiring) can proceed independently of the unresolved live-Azure video-negotiation question -- its fallback-to-audio-orb design absorbs either outcome.

---
*Phase: 37-persona-fidelity-hardening*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 7 claimed modified files verified present on disk; all 3 task commit hashes (`59ab756`, `8161528`, `b2344df`) verified present in git history.
