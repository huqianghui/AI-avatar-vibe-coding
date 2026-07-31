# Phase 08: Voice & Avatar Demo Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Azure Voice Live Agent with Avatar into the AI Avatar platform for real-time voice coaching with digital HCP avatar. All 7 Azure AI interaction modes are implemented through a unified Azure AI Foundry endpoint resource type. The reference implementation is the user's Voice-Live-Agent-With-Avadar repo. Plans 08-01 through 08-03 are complete — remaining work is container wiring, route registration, admin config card, transcript persistence, and comprehensive testing.

</domain>

<decisions>
## Implementation Decisions

### Azure AI Foundry Unified Endpoint
- **D-01:** ALL 7 interaction modes use Azure AI Foundry endpoint as the single resource type — no separate Azure service endpoints
- **D-02:** The 7 modes: (1) Azure OpenAI text, (2) Azure Speech STT, (3) Azure Speech TTS, (4) Azure AI Avatar, (5) Azure Content Understanding, (6) Azure OpenAI Realtime, (7) Azure Voice Live API
- **D-03:** Voice Live API WSS endpoint pattern: `wss://<foundry-resource>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-05-01-preview&agent-project-name=<name>&agent-id=<id>&agent-access-token=<token>`
- **D-04:** Supported regions limited to eastus2 and swedencentral per Azure Voice Live API availability

### Voice Session Entry Flow
- **D-05:** Voice session starts from scenario selection page with mode URL parameter — same pattern as existing F2F and conference session entry
- **D-06:** VoiceSessionPage reads `?id=<sessionId>&mode=<voice|avatar>` from URL search params (already implemented)
- **D-07:** Route registration adds `/voice-session` to the router alongside existing `/training-session` and `/conference-session`

### Admin Voice Live Configuration Card
- **D-08:** Voice Live config card in admin Azure Config page follows ServiceConfigCard pattern from Phase 07
- **D-09:** Voice Live card fields: AI Foundry endpoint, API key, agent-project-name, agent-id, avatar character/style selector, voice name selector
- **D-10:** Agent mode needs: ai_service_endpoint, azure_ai_project_name, agent_id, Entra access token (scope: `https://ai.azure.com/.default`)
- **D-11:** Model mode needs: AI Foundry endpoint, API key, deployment name (gpt-4o-realtime-preview)
- **D-12:** Region availability hints shown per service — "Not available in {region}" status when applicable

### Avatar Rendering
- **D-13:** Avatar uses WebRTC peer connection — ICE servers provided dynamically by Azure Avatar service during session init
- **D-14:** Avatar configuration supports both predefined avatars (character-style parsing) and custom avatars (character name with `customized: true`)
- **D-15:** Video parameters: H.264 codec with crop coordinates [560, 0] to [1360, 1080] per reference repo

### Session Lifecycle & Fallback
- **D-16:** Fallback chain: avatar failure → voice-only → text mode (D-10 from prior plans, already in VoiceSession component)
- **D-17:** Session end navigates to scoring page — same lifecycle as F2F (created → in_progress → completed → scored)
- **D-18:** Transcript flush-before-end-session uses pendingFlushesRef with Promise.all (D-09 from prior plans)
- **D-19:** Token broker returns raw API key — frontend connects directly to Azure (D-08 from prior plans)

### Testing Strategy
- **D-20:** Comprehensive tests based on .env configuration — test all 7 Azure AI modes with real Azure services when configured
- **D-21:** Tests must verify: route registration, admin config CRUD, token broker, transcript persistence, session lifecycle, fallback behavior
- **D-22:** Unit tests for each adapter/service, integration tests for API routes, component tests for voice UI
- **D-23:** >=95% test coverage requirement maintained

### Claude's Discretion
- Exact WebRTC error handling and retry logic
- Avatar video element sizing and responsive behavior
- Toast notification wording for connection state changes
- Test mock strategy for WebRTC/audio APIs in unit tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Implementation
- `https://github.com/huqianghui/Voice-Live-Agent-With-Avadar` — User's reference repo for Voice Live + Avatar patterns, session flow, config, WebRTC avatar rendering

### Backend — Voice Live (Phase 08 output, plans 01-03)
- `backend/app/api/voice_live.py` — Voice Live API routes (token broker, status)
- `backend/app/schemas/voice_live.py` — Pydantic schemas for voice live
- `backend/app/services/voice_live_service.py` — Voice Live service logic
- `backend/app/services/agents/adapters/azure_voice_live.py` — Azure Voice Live adapter

### Backend — Azure Config (Phase 07 output)
- `backend/app/api/azure_config.py` — CRUD API for service configs
- `backend/app/models/service_config.py` — ServiceConfig ORM model with Fernet encryption
- `backend/app/services/config_service.py` — Config CRUD + encryption
- `backend/app/services/connection_tester.py` — Connection testing

### Frontend — Voice Components (Phase 08 output, plans 02-03)
- `frontend/src/components/voice/voice-session.tsx` — Main VoiceSession container
- `frontend/src/components/voice/avatar-view.tsx` — Avatar WebRTC renderer
- `frontend/src/components/voice/voice-controls.tsx` — Voice control buttons
- `frontend/src/components/voice/voice-transcript.tsx` — Transcript display
- `frontend/src/components/voice/voice-session-header.tsx` — Session header
- `frontend/src/pages/user/voice-session.tsx` — Voice session page

### Frontend — Hooks & Data Layer (Phase 08 output, plans 02-03)
- `frontend/src/hooks/use-voice-live.ts` — Voice Live WebSocket hook
- `frontend/src/hooks/use-avatar-stream.ts` — Avatar WebRTC stream hook
- `frontend/src/hooks/use-voice-token.ts` — Token broker hook
- `frontend/src/api/voice-live.ts` — Typed API client
- `frontend/src/types/voice-live.ts` — TypeScript type definitions

### Frontend — Admin Config (Phase 07 output)
- `frontend/src/pages/admin/azure-config.tsx` — Azure config page
- `frontend/src/components/admin/service-config-card.tsx` — Reusable config card

### Configuration
- `backend/.env.example` — Environment variable template
- `backend/.env` — Current config with Azure OpenAI keys, voice_live mode active

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoiceSession` container: Already orchestrates all voice hooks and leaf components
- `VoiceSessionPage`: Full-screen page following conference-session pattern
- `ServiceConfigCard`: Reusable admin config card with status dot, test connection, save
- `useVoiceLive` hook: WebSocket connection management with transcript callbacks
- `useAvatarStream` hook: WebRTC peer connection for avatar video
- `useAudioHandler` hook: Microphone capture and audio playback
- `useVoiceToken` hook: Token broker API integration

### Established Patterns
- Full-screen session pages without UserLayout (conference-session, training-session)
- SSE streaming for real-time responses (F2F, conference)
- ServiceConfigCard for admin Azure service configuration
- TanStack Query hooks per domain with dedicated query key namespaces
- Voice i18n as dedicated namespace for lazy-loading

### Integration Points
- Router: Add `/voice-session` route alongside `/training-session` and `/conference-session`
- Navigation: Add voice session link in scenario selection or session type chooser
- Admin config: Add Voice Live and Avatar cards to `azure-config.tsx`
- Session lifecycle: Wire voice session to existing scoring/feedback pipeline
- Feature toggles: `FEATURE_VOICE_ENABLED` and `FEATURE_AVATAR_ENABLED` gate visibility

</code_context>

<specifics>
## Specific Ideas

- Follow Voice-Live-Agent-With-Avadar repo patterns for Voice Live session flow and avatar WebRTC setup
- All 7 Azure AI modes should be testable through Azure AI Foundry endpoint (user's explicit requirement)
- .env already has real Azure OpenAI keys configured — tests should leverage this for real integration testing
- Avatar ICE servers come dynamically from Azure service during session init — no hardcoded STUN/TURN
- Support both Agent mode (with agent-project-name + agent-id) and Model mode (direct OpenAI Realtime)

</specifics>

<deferred>
## Deferred Ideas

- Per-session provider override (always use deployment-wide config for now)
- Live Azure Management API for region capability querying (start with hardcoded map)
- Multiple avatar characters selectable per HCP profile — future enhancement
- Azure AD SSO integration for Entra token acquisition — future phase (AUTH-V2-01)

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-voice-avatar-demo-integration*
*Context gathered: 2026-03-27*
