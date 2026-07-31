# Research Summary: AI Avatar Platform (BeiGene MR Training)

**Domain:** AI-powered pharma Medical Representative training platform
**Researched:** 2026-03-24
**Overall confidence:** HIGH

## Executive Summary

The AI Avatar Platform for BeiGene requires integrating five distinct Azure AI services (OpenAI, Speech, Avatar, Content Understanding, Voice Live) into an existing FastAPI + React skeleton. Research confirms all core services are GA and well-documented. The project deploys on Azure Global, where all required services (OpenAI, Speech, Avatar, Content Understanding) are available. Azure TTS Avatar is available in 7 regions -- region selection matters for co-locating services.

The existing codebase skeleton (FastAPI, React 18, SQLAlchemy async, Pydantic v2, Vite 6, TanStack Query v5) is well-chosen and should be kept as-is. The investment goes entirely into Azure AI service integrations and the domain-specific coaching features. The new Azure OpenAI v1 API (GA since August 2025) eliminates the previous pain of monthly api-version updates and allows using the standard `OpenAI()` client with an Azure base_url -- a significant developer experience improvement.

The Voice Live API is a standout discovery: it unifies STT + LLM + TTS + Avatar into a single managed WebSocket, eliminating the complex orchestration of chaining these services manually. However, it is a newer service (pricing effective July 2025) and should be adopted as an enhancement after proving the basic voice pipeline with individual services. The two-tier approach (Voice Live for premium experience, basic Speech SDK for fallback) aligns with the budget constraint noted in PROJECT.md.

For the prototype demo (week of 2026-03-24), the critical path is: text chat with AI HCP -> scoring -> voice mode -> i18n. Avatar and Voice Live are phase 2 enhancements. The i18n framework (react-i18next) must be integrated from day 1 per the European expansion constraint.

## Key Findings

**Stack:** Keep existing skeleton. Add Azure OpenAI v1 API (openai>=2.29.0), Azure Speech SDK, Azure Content Understanding SDK, react-i18next for i18n, Recharts for scoring dashboards. Use Voice Live API as premium voice+avatar path.

**Architecture:** Backend WebSocket proxy pattern for Realtime/Voice Live (browser cannot connect directly to Azure due to CORS/credentials). Browser-side WebRTC for Avatar rendering via Speech SDK JS. Provider-agnostic adapter layer (BaseCoachingAdapter) already in skeleton -- extend it.

**Critical pitfall:** Azure TTS Avatar is only in 7 regions. Select deployment region carefully to co-locate all services (Avatar + OpenAI + Speech).

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation + Text Coaching** - Establish core domain models, text-based F2F coaching with GPT-4.1, scoring system, i18n framework
   - Addresses: FR-2.1, FR-2.2, FR-2.4, FR-4.1, FR-4.6, i18n requirement
   - Avoids: Pitfall of building voice/avatar first without stable text foundation
   - Dependencies: None (builds on existing skeleton)

2. **Phase 2: Voice Interaction** - Add Azure Speech STT/TTS for voice input/output, real-time transcription
   - Addresses: FR-2.3, FR-2.5, FR-7.2
   - Avoids: Pitfall of coupling voice to specific provider (use adapter pattern)
   - Dependencies: Phase 1 (needs working text coaching to add voice layer)

3. **Phase 3: Avatar + Premium Voice** - Add TTS Avatar for visual HCP, Voice Live API as unified premium path
   - Addresses: FR-6.1 (HCP visual), differentiator features
   - Avoids: Pitfall of Avatar region lock-in (select region with avatar support)
   - Dependencies: Phase 2 (voice pipeline must work before adding avatar)

4. **Phase 4: Conference Mode + Content Understanding** - One-to-many presentation simulation, training material analysis
   - Addresses: FR-3.1 through FR-3.7, FR-1.1, FR-1.2
   - Avoids: Pitfall of building conference before F2F is solid
   - Dependencies: Phase 2 (reuses voice pipeline), Phase 1 (scoring system)

5. **Phase 5: Dashboards + Reports** - Organizational analytics, PDF/Excel export, admin features
   - Addresses: FR-5.1 through FR-5.6
   - Avoids: Pitfall of building dashboards before data exists
   - Dependencies: Phases 1-3 (needs accumulated scoring data)

6. **Phase 6: Production Hardening** - Azure AD SSO, data retention policies, Teams Tab embedding
   - Addresses: NFR-1 through NFR-6, out-of-scope items preparation
   - Dependencies: All previous phases

**Phase ordering rationale:**
- Text before voice: proves LLM integration, scoring, and domain model without audio complexity
- Voice before avatar: avatar is a visual layer on top of working voice -- incremental addition
- F2F before conference: conference is "F2F but with multiple HCPs" -- same patterns, more complexity
- Coaching before dashboards: dashboards need data from coaching sessions to display

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need research. GPT-4.1 structured outputs are well-documented.
- Phase 2: May need research on Azure Speech SDK Chinese voice quality and real-time STT latency
- Phase 3: LIKELY NEEDS DEEPER RESEARCH -- Avatar WebRTC setup is complex, Voice Live API is newer. Check sample code carefully.
- Phase 4: LIKELY NEEDS DEEPER RESEARCH -- Conference mode multi-HCP turn management has no standard pattern. Content Understanding custom analyzer configuration needs investigation.
- Phase 5: Standard patterns for charting and export
- Phase 6: Standard patterns for Azure AD SSO and data retention policies.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified from official docs and PyPI/npm. Azure v1 API confirmed GA. |
| Features | HIGH | Based on detailed requirements doc + Capgemini reference solution + competitor landscape |
| Architecture | HIGH | WebSocket proxy pattern and adapter pattern are well-established. Avatar WebRTC is documented with sample code. |
| Pitfalls | HIGH | Avatar region constraints verified. All services available on Azure Global. |
| i18n | HIGH | react-i18next is de facto standard, Vite compatible, TypeScript supported |
| Voice Live API | MEDIUM | Newer service (2025), well-documented but less battle-tested than individual services |

## Gaps to Address

- **Voice Live API pricing:** Pricing effective July 2025, but actual cost per session for this use case needs estimation. Consider cost modeling before committing to Voice Live for all interactions.
- **Content Understanding custom analyzers:** The pre-built analyzers handle generic document types. Training material extraction (key messages, scoring criteria from pharma content) will likely need custom analyzer configuration -- this needs investigation in Phase 4.
- **Chinese TTS voice quality:** Azure TTS Chinese voices are available but quality compared to English HD voices needs hands-on evaluation. Consider testing `zh-CN-XiaoxiaoNeural` and `zh-CN-YunxiNeural` early.
- **Recharts radar chart customization:** Multi-dimensional scoring requires a customized radar/spider chart. Recharts supports RadarChart but specific design matching the Figma mockups needs validation during implementation.
