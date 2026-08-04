# Deferred Items — Phase 38 Plan 01

Out-of-scope discoveries found during execution, not fixed per the deviation rules'
scope boundary (only auto-fix issues directly caused by this task's changes).

## Flaky live-Azure network tests in test_voice_live_websocket.py

The following tests make real outbound WebSocket connections to Azure AI Foundry
using `DefaultAzureCredential` (via `AzureCliCredential`) and a real endpoint. They
are unrelated to the VMODE-01 `resolve_voice_config()` rewrite (they don't touch
`HcpProfile` at all, or in one case use a fixture unaffected by our change) and fail
intermittently in this sandboxed environment with
`ConnectionError: Failed to establish WebSocket connection: [Errno 54] Connection
reset by peer`:

- `TestRealAzureSessionConfig::test_real_connect_model_mode_session_config_accepted`
- `TestRealAzureSessionConfig::test_real_transcription_model_azure_speech_accepted`
- `TestRealVoiceLiveIntegration::test_real_model_mode_full_session_config_accepted`
- `TestRealVoiceLiveIntegration::test_real_model_mode_english_voice_accepted`
- `TestRealVoiceLiveIntegration::test_real_model_mode_with_instructions`

Verified pre-existing/environmental: running this same test class in isolation
produces a different subset of failures each run (1 of 4 failed on one run, all 5
failed on another), consistent with network flakiness rather than a code
regression. `TestRealVoiceLiveIntegration::test_real_config_resolution_with_hcp_agent`
-- which DOES exercise the `hcp_profile_with_agent` fixture touched by this plan --
passed consistently across all runs.

No action taken. Not blocking for Plan 38-01.

## Plan 38-02: pre-existing failing unit test unrelated to VMODE-01

`frontend/src/pages/login.test.tsx > LoginPage > navigates user to /user/dashboard
on login success` fails on the full `npx vitest run` pass:

```
expect(mockNavigate).toHaveBeenCalledWith("/user/dashboard");
Received: "/"
```

`login.tsx`/`login.test.tsx` were never read or modified during Plan 38-02
execution. The mismatch (`/` vs `/user/dashboard`) looks like a leftover from a
separate, unrelated change to the post-login landing redirect (see Phase 36
"avatar-persona-selection-post-login-landing" in `.planning/phases/`, which was
in-progress in this repo's working tree at the time of this session per the
initial `git status`). Not fixed per the scope boundary rule -- out of scope for
Plan 38-02 (voice-mode config replacement), not caused by any Task 1/2/3 change.
