# Phase 08: Voice & Avatar Demo Integration - Research

**Researched:** 2026-03-27
**Domain:** Azure Voice Live API + AI Avatar WebRTC integration, container component wiring, route/admin config, transcript persistence
**Confidence:** HIGH

## Summary

Phase 08 integrates Azure Voice Live API (real-time speech-to-speech) and Azure AI Avatar (WebRTC digital human) into the AI Avatar platform. Plans 01-03 are complete, delivering: backend voice_live API (token broker, status endpoint, connection tester, Alembic migration for session mode), frontend data layer (types, API client, TanStack Query hooks, audio-processor.js), and all voice UI components plus hooks (useVoiceLive, useAvatarStream, useAudioHandler, 7 leaf components). The remaining Plan 04 covers container wiring -- connecting VoiceSession to the router (already done), the admin config Voice Live card (already implemented in ServiceConfigCard with agent/model mode), transcript flush persistence, and comprehensive end-to-end testing.

The codebase inspection reveals that most Plan 04 integration points are already in place from plans 01-03 execution. The router has `/user/training/voice` registered. The admin Azure Config page already includes the Voice Live card with agent/model mode selector. The VoiceSession container is fully wired with all hooks and leaf components. The primary remaining work is: (1) verifying all integration points connect properly end-to-end, (2) ensuring the scenario selection page can route users to voice sessions, (3) comprehensive test coverage for the wired system, and (4) any gap-filling for edge cases in the existing code.

**Primary recommendation:** Focus Plan 04 on integration testing, voice session entry from scenario selection (currently no voice tab/button exists in training.tsx), and comprehensive test coverage rather than building new components -- nearly all code already exists.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: ALL 7 interaction modes use Azure AI Foundry endpoint as the single resource type
- D-02: The 7 modes: (1) Azure OpenAI text, (2) Azure Speech STT, (3) Azure Speech TTS, (4) Azure AI Avatar, (5) Azure Content Understanding, (6) Azure OpenAI Realtime, (7) Azure Voice Live API
- D-03: Voice Live API WSS endpoint pattern: `wss://<foundry-resource>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-05-01-preview&agent-project-name=<name>&agent-id=<id>&agent-access-token=<token>`
- D-04: Supported regions limited to eastus2 and swedencentral per Azure Voice Live API availability
- D-05: Voice session starts from scenario selection page with mode URL parameter
- D-06: VoiceSessionPage reads `?id=<sessionId>&mode=<voice|avatar>` from URL search params (already implemented)
- D-07: Route registration adds `/voice-session` to the router (already done as `/user/training/voice`)
- D-08: Voice Live config card follows ServiceConfigCard pattern (already implemented)
- D-09: Voice Live card fields: AI Foundry endpoint, API key, agent-project-name, agent-id, avatar character/style selector, voice name selector
- D-10: Agent mode needs: ai_service_endpoint, azure_ai_project_name, agent_id, Entra access token
- D-11: Model mode needs: AI Foundry endpoint, API key, deployment name (gpt-4o-realtime-preview)
- D-12: Region availability hints shown per service
- D-13: Avatar uses WebRTC peer connection with dynamic ICE servers
- D-14: Avatar configuration supports predefined and custom avatars
- D-15: Video parameters: H.264 codec with crop coordinates [560, 0] to [1360, 1080]
- D-16: Fallback chain: avatar failure -> voice-only -> text mode
- D-17: Session end navigates to scoring page (same lifecycle as F2F)
- D-18: Transcript flush-before-end-session uses pendingFlushesRef with Promise.all
- D-19: Token broker returns raw API key
- D-20: Comprehensive tests based on .env configuration
- D-21: Tests must verify: route registration, admin config CRUD, token broker, transcript persistence, session lifecycle, fallback behavior
- D-22: Unit tests for each adapter/service, integration tests for API routes, component tests for voice UI
- D-23: >=95% test coverage requirement maintained

### Claude's Discretion
- Exact WebRTC error handling and retry logic
- Avatar video element sizing and responsive behavior
- Toast notification wording for connection state changes
- Test mock strategy for WebRTC/audio APIs in unit tests

### Deferred Ideas (OUT OF SCOPE)
- Per-session provider override (always use deployment-wide config)
- Live Azure Management API for region capability querying (hardcoded map)
- Multiple avatar characters selectable per HCP profile
- Azure AD SSO integration for Entra token acquisition (AUTH-V2-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COACH-04 | Voice input via Azure Speech STT | Already implemented in Phase 03; Voice Live API subsumes this with native audio input. No additional work needed. |
| COACH-05 | AI HCP responses spoken via Azure Speech TTS | Already implemented in Phase 03; Voice Live API handles TTS natively. Config card for TTS exists. |
| COACH-07 | Azure AI Avatar renders digital human for HCP as configurable premium option | useAvatarStream hook implements WebRTC connection. AvatarView component renders video. Fallback to voice-only on failure (D-16). Admin config card exists. |
| EXT-04 | Azure Voice Live API as unified premium voice+avatar path | Token broker API, useVoiceLive hook, VoiceSession container all implemented. Admin Voice Live card with agent/model mode selector exists. Remaining: integration testing, scenario selection entry point. |
| PLAT-05 | Voice interaction mode configurable per deployment and per session | Session model has `mode` field (text/voice/avatar). Feature toggles (feature_voice_enabled, feature_voice_live_enabled) in config. Admin can configure via Azure Config page. |
</phase_requirements>

## Standard Stack

### Core (already installed and in use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rt-client | 0.5.2 | Azure Voice Live API WebSocket client | Official Azure SDK for realtime voice, installed from tgz file |
| react | 18.3+ | UI framework | Project standard |
| @tanstack/react-query | 5.60+ | Server state management | Project standard for all API hooks |
| fastapi | 0.115+ | Backend API framework | Project standard |
| pydantic | 2.x | Request/response schemas | Project standard |
| vitest | latest | Frontend unit testing | Project standard for frontend tests |
| pytest | 8.3+ | Backend testing | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | installed | Toast notifications | Connection state changes, errors, fallback notifications |
| lucide-react | 0.460+ | Icons | Phone icon for voice live card, Mic for voice controls |
| react-i18next | installed | Internationalization | voice.json namespace for all voice UI strings |

### No New Packages Required

All dependencies are already in place from plans 01-03. The rt-client 0.5.2 tgz is present in the frontend directory but may need `npm install` to be fully resolved in node_modules (check revealed it is not currently in node_modules).

## Architecture Patterns

### Current Implementation Structure (Plans 01-03 Output)
```
backend/
  app/
    api/voice_live.py              # Token broker + status endpoints (DONE)
    schemas/voice_live.py          # Pydantic schemas (DONE)
    services/voice_live_service.py # Service logic (DONE)
    services/connection_tester.py  # Voice Live connection testing (DONE)
    services/region_capabilities.py # Region availability map (DONE)
    models/session.py              # mode field added (DONE)
  alembic/versions/
    a1b2c3d4e5f6_add_session_mode.py  # Migration (DONE)

frontend/
  src/
    api/voice-live.ts              # API client (DONE)
    types/voice-live.ts            # TypeScript types (DONE)
    types/azure-config.ts          # VoiceLiveMode types (DONE)
    hooks/
      use-voice-live.ts            # WebSocket hook (DONE)
      use-avatar-stream.ts         # WebRTC hook (DONE)
      use-audio-handler.ts         # Microphone/AudioWorklet (DONE)
      use-voice-token.ts           # Token broker hook (DONE)
    components/voice/
      voice-session.tsx            # Container orchestrator (DONE)
      avatar-view.tsx              # WebRTC video renderer (DONE)
      voice-controls.tsx           # Mute/keyboard/fullscreen (DONE)
      voice-transcript.tsx         # Transcript display (DONE)
      voice-session-header.tsx     # Header bar (DONE)
      floating-transcript.tsx      # Full-screen overlay (DONE)
      waveform-viz.tsx             # Audio visualizer (DONE)
      mode-selector.tsx            # Text/voice/avatar selector (DONE)
      connection-status.tsx        # Status indicator (DONE)
    pages/user/voice-session.tsx   # Full-screen page (DONE)
  public/
    audio-processor.js             # AudioWorklet processor (DONE)
    locales/en-US/voice.json       # i18n voice namespace (DONE)
```

### Integration Points for Plan 04

| Integration Point | Current State | Work Needed |
|---|---|---|
| Router `/user/training/voice` | Registered in router/index.tsx | DONE - verify works end-to-end |
| Admin Azure Config Voice Live card | ServiceConfigCard renders for voiceLive key with agent/model selector | DONE - verify CRUD works |
| Scenario selection -> voice session | training.tsx has NO voice tab or button; only F2F and conference tabs | NEEDS WORK - add voice session entry |
| Voice Live router in main.py | voice_live_router included | DONE |
| Session mode in create session | SessionCreate schema accepts mode field | DONE - verify voice sessions created properly |
| Transcript persistence to sessions/{id}/messages | persistTranscriptMessage in voice-live.ts calls POST | DONE - verify backend handler accepts voice_transcript source |
| Feature toggle gating | feature_voice_live_enabled in config.py | Verify toggle gates voice entry in scenario selection |
| Scoring after voice session | VoiceSession navigates to `/user/scoring/${sessionId}` | DONE - same as F2F/conference |

### Pattern: Session Entry Flow (Voice)
```
ScenarioSelection -> Create Session (POST /sessions with mode=voice|avatar)
  -> Navigate to /user/training/voice?id={sessionId}&mode={mode}
    -> VoiceSessionPage reads params
      -> VoiceSession container initializes hooks
        -> Token broker -> Voice Live connect -> Avatar connect (if mode=avatar)
          -> Transcript display, controls, scoring on end
```

### Anti-Patterns to Avoid
- **Duplicating ServiceConfigCard logic for Voice Live**: The card already supports Voice Live with agent/model mode selection -- do not create a separate component
- **Hardcoding voice session start URL**: Follow the existing pattern where scenario selection uses `navigate()` with URL params
- **Skipping transcript flush before session end**: The pendingFlushesRef pattern is already implemented -- do not bypass it

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket management | Custom WebSocket wrapper | rt-client SDK (0.5.2) | Handles reconnection, session config, audio encoding |
| WebRTC connection | Manual RTCPeerConnection setup beyond useAvatarStream | Existing useAvatarStream hook | Already handles ICE gathering, SDP exchange, track injection |
| Audio capture | Raw getUserMedia | useAudioHandler hook | Manages AudioWorklet, AnalyserNode, cleanup lifecycle |
| Admin config cards | Custom Voice Live config form | ServiceConfigCard with voiceLive mode detection | Already implements agent/model radio, field validation, save/test |
| Region capabilities | API call to Azure Management | region_capabilities.py hardcoded map | Locked decision -- no live querying |

## Common Pitfalls

### Pitfall 1: rt-client Not in node_modules
**What goes wrong:** `npm ls rt-client` shows empty -- the tgz is present but not installed
**Why it happens:** node_modules may not include it after clean install if tgz path resolution fails
**How to avoid:** Run `npm install` in frontend directory to ensure rt-client-0.5.2.tgz resolves. Verify with `npm ls rt-client`.
**Warning signs:** useVoiceLive dynamic import `import("rt-client")` throws at runtime

### Pitfall 2: No Voice Session Entry in Scenario Selection
**What goes wrong:** Users cannot start a voice session from the training page
**Why it happens:** training.tsx only has F2F and Conference tabs -- no voice option exists
**How to avoid:** Add a voice session start flow (third tab or mode selector on scenario card) that creates a session with mode=voice|avatar and navigates to `/user/training/voice?id={id}&mode={mode}`
**Warning signs:** The voice session page only works if navigated to directly via URL

### Pitfall 3: Transcript Not Persisted for Scoring
**What goes wrong:** After voice session ends, scoring page has no conversation to analyze
**Why it happens:** persistTranscriptMessage POSTs to `/sessions/{id}/messages` but backend may not handle `source: "voice_transcript"` or the format may differ from what scoring expects
**How to avoid:** Verify that POST to sessions/{id}/messages creates SessionMessage records that the scoring service reads for analysis
**Warning signs:** Scoring page shows "No conversation data" after voice session

### Pitfall 4: WebRTC/Audio APIs in Test Environment
**What goes wrong:** Tests fail because jsdom has no RTCPeerConnection, MediaDevices, AudioContext
**Why it happens:** These are browser-only APIs not available in test runner
**How to avoid:** Mock WebRTC, AudioContext, and getUserMedia at the test setup level. The existing test files (voice-controls.test.tsx, etc.) already mock these -- follow the same pattern.
**Warning signs:** "RTCPeerConnection is not defined" errors in vitest

### Pitfall 5: Feature Toggle Not Gating Voice Entry
**What goes wrong:** Voice option appears in scenario selection even when voice is disabled
**Why it happens:** Feature toggle check (feature_voice_live_enabled) not applied to the new voice entry UI
**How to avoid:** Check `voice_enabled` or `feature_voice_live_enabled` from config context before rendering voice session option
**Warning signs:** Voice tab/button visible in local dev where voice is not configured

### Pitfall 6: Voice Live Region Mismatch
**What goes wrong:** Region shown as "available" but Voice Live connection fails
**Why it happens:** VOICE_LIVE_REGIONS in region_capabilities.py was updated to include many regions, but SUPPORTED_REGIONS in voice_live_service.py only has eastus2 and swedencentral
**How to avoid:** Ensure SUPPORTED_REGIONS uses VOICE_LIVE_REGIONS import consistently. Current code has `SUPPORTED_REGIONS = VOICE_LIVE_REGIONS` which is correct.
**Warning signs:** Connection test succeeds but Voice Live WebSocket connection fails at runtime

## Code Examples

### Existing: Voice Session Page Entry Pattern
```typescript
// frontend/src/pages/user/voice-session.tsx (already implemented)
const sessionId = searchParams.get("id") ?? "";
const mode = (searchParams.get("mode") ?? "voice") as SessionMode;
```

### Existing: Admin Config Voice Live Card Pattern
```typescript
// frontend/src/pages/admin/azure-config.tsx (already implemented)
{
  key: "voiceLive",
  name: "Azure Voice Live API",
  description: "Real-time voice coaching with GPT-4o Realtime",
  icon: <Phone className="size-6 text-primary" />,
}
```

### Needed: Scenario Selection Voice Entry (gap to fill)
```typescript
// Pattern to add in training.tsx -- voice session start
const handleStartVoiceSession = async (scenarioId: string, mode: SessionMode) => {
  const session = await createSession.mutateAsync({ scenario_id: scenarioId, mode });
  navigate(`/user/training/voice?id=${session.id}&mode=${mode}`);
};
```

### Existing: Transcript Persistence Pattern
```typescript
// frontend/src/api/voice-live.ts (already implemented)
export async function persistTranscriptMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await apiClient.post(`/sessions/${sessionId}/messages`, {
    message: content,
    role,
    source: "voice_transcript",
  });
}
```

### Existing: Backend Token Broker Pattern
```python
# backend/app/services/voice_live_service.py (already implemented)
async def get_voice_live_token(db: AsyncSession) -> VoiceLiveTokenResponse:
    vl_config = await config_service.get_config(db, "azure_voice_live")
    api_key = await config_service.get_decrypted_key(db, "azure_voice_live")
    return VoiceLiveTokenResponse(
        endpoint=vl_config.endpoint,
        token=api_key,
        ...
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual STT+LLM+TTS orchestration | Voice Live API unified pipeline | 2025 GA | Single WebSocket replaces 3 separate services |
| rt-client SDK (file-based tgz) | openai SDK with RealtimeWS | 2025-2026 | Official OpenAI SDK now supports Azure realtime natively |
| Fixed STUN/TURN servers | Dynamic ICE from Azure Avatar service | Current | No hardcoded WebRTC config needed |
| API key only auth | Entra ID recommended, API key supported | 2025+ | D-19 uses API key for now; Entra deferred |

**Azure Voice Live API (as of 2026-01):**
- Supports models: gpt-realtime, gpt-4o, gpt-4.1, gpt-5, phi-4, and more
- Single WebSocket manages speech recognition + LLM + TTS + avatar
- Compatible with Azure OpenAI Realtime API events
- Avatar integration is additive (optional session parameter)
- Available in 20+ regions (expanded from initial 2-region launch)

**Note on rt-client vs OpenAI SDK:** The project uses rt-client 0.5.2 (file-based install). The newer approach uses the official `openai` npm package with `OpenAIRealtimeWS`. Since rt-client is already integrated and the useVoiceLive hook wraps it, migration would be significant work -- not recommended for this phase.

## Open Questions

1. **useCreateSession hook vs direct API call for voice mode**
   - What we know: `useCreateSession` in use-session.ts calls `createSession(scenarioId)` which may not pass the `mode` parameter
   - What's unclear: Whether the create session API handler accepts and stores mode correctly for voice sessions
   - Recommendation: Verify `useCreateSession` hook and its backend endpoint accept `mode` parameter; if not, extend it

2. **Scoring service reading voice transcripts**
   - What we know: Voice transcripts are persisted via `persistTranscriptMessage` to `/sessions/{id}/messages`
   - What's unclear: Whether the scoring service reads these messages when analyzing the conversation
   - Recommendation: Verify that the scoring flow works identically for voice session messages

3. **Feature toggle granularity**
   - What we know: `feature_voice_enabled`, `feature_realtime_voice_enabled`, `feature_voice_live_enabled` all exist
   - What's unclear: Which toggle should gate the voice tab in scenario selection
   - Recommendation: Use `feature_voice_live_enabled` specifically for the Voice Live path; check via config context

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Assumed (project standard) | -- | -- |
| Node 20+ | Frontend | Assumed (project standard) | -- | -- |
| rt-client | useVoiceLive hook | tgz present, NOT in node_modules | 0.5.2 | Must run npm install |
| Azure Voice Live API | Real-time voice | External service (needs config) | 2025-05-01-preview | Text mode fallback |
| Azure AI Avatar | Digital human rendering | External service (needs config) | Current | Voice-only fallback |
| WebRTC browser support | Avatar video | Modern browsers | Native | Voice-only fallback |
| AudioWorklet support | Microphone capture | Modern browsers | Native | Text mode fallback |

**Missing dependencies with no fallback:**
- rt-client must be installed (run `npm install` in frontend/)

**Missing dependencies with fallback:**
- Azure Voice Live API: falls back to text mode (D-16)
- Azure AI Avatar: falls back to voice-only (D-16)

## Project Constraints (from CLAUDE.md)

- **Async everywhere** in backend: all handlers use `async def`, `await`, `AsyncSession`
- **Pydantic v2** for schemas with `ConfigDict(from_attributes=True)`
- **Route ordering**: Static paths before parameterized
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic, routers only handle HTTP
- **TypeScript strict mode**: no `any`, no unused variables
- **TanStack Query hooks** per domain, no inline useQuery
- **Path alias** `@/` for imports
- **cn() utility** for conditional classes
- **Conventional commits** (`feat:`, `fix:`, `test:`)
- **i18n**: all UI text externalized via react-i18next
- **Alembic** for all schema changes with batch operations for SQLite
- **No raw SQL** -- use SQLAlchemy ORM
- **>=95% test coverage** requirement
- Pre-commit checks: `ruff check .`, `ruff format --check .`, `pytest -v`, `npx tsc -b`, `npm run build`

## Sources

### Primary (HIGH confidence)
- Codebase inspection: backend/app/api/voice_live.py, services/voice_live_service.py, schemas/voice_live.py
- Codebase inspection: frontend/src/components/voice/*.tsx, hooks/use-voice-live.ts, hooks/use-avatar-stream.ts
- Codebase inspection: frontend/src/router/index.tsx, pages/admin/azure-config.tsx, components/admin/service-config-card.tsx
- Codebase inspection: frontend/src/pages/user/voice-session.tsx, training.tsx
- Codebase inspection: backend/app/main.py (voice_live_router registered), models/session.py (mode field), config.py (feature toggles)
- [Azure Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) - Official docs, confirmed features and model support
- [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) - WebSocket patterns, authentication methods
- [Azure AI Avatar Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) - Avatar capabilities, WebRTC integration, sample code links

### Secondary (MEDIUM confidence)
- [Voice Live Avatar Samples](https://github.com/azure-ai-foundry/voicelive-samples/tree/main/javascript/voice-live-avatar) - GitHub repo structure and patterns

### Tertiary (LOW confidence)
- Region availability may have expanded beyond what is hardcoded in region_capabilities.py (Voice Live API docs mention 20+ regions as of 2026-01)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages identified from codebase inspection, versions verified
- Architecture: HIGH - all components exist from plans 01-03, integration points mapped from source
- Pitfalls: HIGH - identified from actual code gaps (no voice tab in training.tsx, rt-client not installed)
- Azure API patterns: MEDIUM - verified from official docs but rt-client 0.5.2 API details from training data

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- all code already exists, Azure API versions pinned)
