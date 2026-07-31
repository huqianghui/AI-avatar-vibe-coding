# Project Research Summary

**Project:** AI Avatar Platform
**Milestone:** v2.0 Avatar MVP (anonymous grounded Q&A + citations, CRM-Excel personalization, es-ES i18n, avatar-first UI, legacy coach hide)
**Domain:** Grounded knowledge-Q&A digital human — brownfield integration onto an existing authenticated MR-coaching platform (FastAPI + React, Azure PaaS)
**Researched:** 2026-07-31
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is not a greenfield RAG-chatbot build — it is a targeted graft of four capabilities onto a mature, authenticated-only coaching platform (Phases 1–31 already shipped). The standard industry pattern for the headline capability (anonymous grounded Q&A with citations) is retrieval → strictness-filtered generation → structured, extractive citations rendered separately from the answer. The critical technical discovery across all four research files is that this repo's existing Foundry IQ integration (the MCP `knowledge_base_retrieve` tool used by the Agent) does NOT return a structured citation envelope — only Azure AI Search's direct `retrieve` REST action does. This single fact reshapes the architecture: citations must come from a second, concurrent `retrieve()` call (the "dual-query shadow" pattern), not by parsing the Agent's own grounding call.

The recommended approach reuses almost everything already in the stack — `httpx`, `openpyxl`, `azure-ai-projects`, `i18next` — and adds exactly one new dependency (`slowapi`, for rate limiting). Architecturally, the safest path is additive: new `AnonymousAvatarSession`, `AvatarInteractionLog`, `PublicKnowledgeConfig`, and `CrmProfileMapping` models sit alongside (not inside) the existing `CoachingSession`/`HcpKnowledgeConfig` tables, which are hard-wired with NOT NULL FKs into the coach domain and are unsafe to repurpose for anonymous/public traffic. A single shared "public avatar" hosted Foundry agent is reused for both anonymous and personalized turns, with per-user CRM context injected at chat time (not baked into agent instructions) to avoid per-user agent sprawl.

The biggest risks are not stack risks but security/trust-boundary risks inherited from a codebase where JWT auth has silently doubled as the only rate limiter and the only Voice-Live cost control. Opening any endpoint to anonymous traffic — chat, citations, or Voice Live tokens — without an explicit rate limiter and a hard-allow-listed single public agent/KB is the top blocking risk (cost exposure on a premium Azure service, plus scope-leakage into personalized/HCP-only agents). The second-biggest risk is citation integrity: because citations require a bespoke extraction path that doesn't exist today, it is easy to ship a demo where the avatar "talks" convincingly while citations are stale, mismatched, or fabricated — this must be tested explicitly, not eyeballed. Both risks are well-understood and have concrete mitigations documented below; there are no open stack-availability blockers.

## Key Findings

### Recommended Stack

Almost none of the four new capabilities need a new heavy dependency — the work is new usage of libraries already present, plus one small new dependency. The one architecturally consequential decision is bypassing the Agent+MCP path for anonymous citations in favor of a direct REST call to Azure AI Search's Knowledge Retrieval `retrieve` action.

**Core technologies:**
- Azure AI Search Knowledge Retrieval `retrieve` REST action (`api-version=2026-05-01-preview`) — the only Foundry IQ code path returning a structured `references[]` array (docKey, sourceData, activitySource); required for auditable, clickable citations. Confirmed via Microsoft Learn: the MCP tool path used by the existing Agent integration does NOT return this envelope.
- `httpx` (existing dep) — call the `retrieve` endpoint directly, reusing the same auth helper pattern already in `knowledge_base_service.py`.
- `openpyxl` (existing dep) — read the CRM Excel mapping table (user_id → profile/preferences) into a DB table; a new read-path, not a new library.
- `fastapi.security.OAuth2PasswordBearer(auto_error=False)` — new `get_current_user_optional` dependency so one endpoint contract can serve both anonymous and logged-in avatar sessions.
- `slowapi >=0.1.10` (new dep) — the one genuinely new package, needed because every other endpoint in this codebase relies on JWT auth as its implicit rate limiter; an anonymous endpoint has none of that protection by default.
- `i18next` / `react-i18next` (existing deps) — adding `es-ES` is a config + content change (locale folder + JSON files), not a library upgrade.

**Gaps flagged in STACK.md:** whether the live Foundry IQ index's `sourceDataFields`/semantic configuration actually projects a document URL + page number is unverified — if not, citations will show titles with no working links and need an indexing-pipeline fix before the anonymous citation UI is "done."

### Expected Features

**Must have (table stakes):**
- No-login entry to avatar Q&A — blocked today by `CoachingSession.user_id` being NOT NULL; needs a dedicated anonymous session mechanism
- Answers grounded only in indexed public-site content, with a defined refusal/fallback for no-match queries — required to avoid unaudited pharma claims
- Per-answer citation (page + document link) rendered as a UI element separate from the avatar's speech/text — explicit `CLAUDE.md` Domain Rule #6/#7, not polish
- Login-gated personalized mode using Excel-based profile mapping + system-prompt preference injection
- Spanish (`es`) added to the i18n framework for UI text
- Clean UI: only digital human + document links visible; legacy coach nav hidden (code retained)

**Should have (competitive/differentiator):**
- Auditable per-response knowledge-source trail (same underlying work as citations, framed for trust)
- Single avatar UI serving both anonymous and personalized modes (recommend "start fresh on login" rather than seamless upgrade, for v1 simplicity)
- Configurable premium Azure AI Avatar with Speech-TTS-only fallback (already exists; confirm it also applies to the new anonymous surface)

**Defer (v1.x / v2+):**
- Mid-session language switching without avatar-session restart (avatar-level Spanish support and reconnect mechanics are unverified — ship "switch = new session" for v1)
- Seamless anonymous→personalized continuity mid-conversation
- Live CRM integration, automated preference learning/deep memory, OAuth/Entra SSO, Teams Tab channel, full legacy code deletion — all explicitly out of scope per `PROJECT.md`

### Architecture Approach

The integration is additive and parallel-structure, not a modification of existing coach-domain models. A new `public_avatar.py` router (no auth, slowapi-limited) and a new `avatar.py` router (JWT-gated) both delegate to one shared `avatar_service.handle_turn()` orchestrator, which runs the existing `agent_chat_service.stream_agent_response()` (reused unchanged) concurrently with a new `avatar_search_service.retrieve()` call for citations, then writes an audit-log row. Personalization is injected per-turn as a prepended context message via a small additive parameter on `agent_chat_service`, not by re-syncing a Foundry agent per user.

**Major components:**
1. `avatar_service.py` (new) — per-turn orchestrator: agent chat stream + citation retrieve (concurrent) + audit-log write
2. `avatar_search_service.py` (new) — direct `httpx` wrapper around AI Search's `retrieve` REST action, reusing existing `SEARCH_API_VERSION`/auth helpers
3. `AnonymousAvatarSession` / `AvatarInteractionLog` / `PublicKnowledgeConfig` (new models) — parallel, low-blast-radius tables kept entirely outside the `CoachingSession`/`HcpKnowledgeConfig` bounded context
4. `personalization_service.py` (new) — builds a per-user context message from `CrmProfileMapping` rows, injected at chat time (not agent-sync time)
5. `crm_mapping_service.py` (new) — Excel ingestion pattern-borrowed from the existing `material_service.py` upload/versioning shape
6. Frontend `avatar-page.tsx` + `sources-panel.tsx` (new) — two distinct DOM regions satisfying the "never merge answer and citation" rule; extends `use-sse.ts` with a `citations` event case

### Critical Pitfalls

1. **App assumes "authenticated everywhere" (router + feature-flag layer)** — `router/index.tsx` wraps everything in `ProtectedRoute`/`GuestRoute` with `/` hardcoded to redirect to `/login`, and `ConfigProvider` only resolves feature flags `if (isAuthenticated)`. Avoid by adding a genuinely public top-level route and a public, unauthenticated `GET /api/v1/config/public` flags endpoint — do not reuse the authenticated `useFeatureFlags` hook.
2. **No rate limiting exists anywhere in the backend today** — JWT auth has been the only cost control on the premium Voice Live/Search/OpenAI path. Any anonymous endpoint without an explicit limiter (`slowapi`) is a direct, fast-accumulating Azure cost and abuse risk from hour one of public exposure. Must be solved in the same phase as the anonymous endpoint, not deferred.
3. **Anonymous WebSocket/chat must not reuse the authenticated trust boundary "with auth made optional"** — build a dedicated, allow-listed single-agent/single-KB anonymous entrypoint; never let an anonymous caller supply an `hcp_profile_id`/agent identifier that could reach personalized or internal-training content.
4. **Citations have no extraction path today and are easy to fake** — `AgentResponseEvent` only carries `text`/`completed`; nothing surfaces which document backed an answer. Must build explicit, tested citation extraction (via the `retrieve` REST call) as a first-class `sources` field from day one — verify with two different questions in a row and confirm citations actually change.
5. **Prompt injection / PII exposure via Excel-derived preference injection** — CRM/Excel values are internal but not automatically safe to concatenate unsanitized into a system prompt; treat as untrusted input (allowlist/delimit), minimize injected fields, and never log full prompts with PII at default level.
6. **Adding `es` silently breaks hardcoded 2-locale assumptions** (`supportedLngs`, an existing E2E assertion, `User.preferred_language`) and i18next's fallback masks missing-translation gaps rather than failing loudly — requires an atomic update plus an automated key-parity check across all namespaces, not manual spot-checking.
7. **"Hide legacy coach entrance" is ambiguous between nav-link hiding and route-guarding** — over-scoping into route guards breaks the large existing E2E suite that navigates via direct `page.goto()`; explicitly scope to nav-link visibility only, leave all routes reachable.

## Implications for Roadmap

Based on combined research, suggested phase structure (dependency-ordered; items within a phase can parallelize):

### Phase 1: Anonymous Session & Public Surface Foundation
**Rationale:** Every other anonymous-mode feature depends on resolving the "authenticated everywhere" assumption baked into the router, `ConfigProvider`, and `CoachingSession.user_id` NOT NULL constraint. This must exist before any anonymous UI or chat logic is written (Pitfall 1).
**Delivers:** New `AnonymousAvatarSession`/`AvatarInteractionLog`/`PublicKnowledgeConfig` models + migration; public unguarded route (`/avatar` or new `/` target); public `GET /api/v1/config/public` flags endpoint; `slowapi` wired into `main.py`.
**Addresses:** "No-login entry to avatar Q&A" (table stakes, FEATURES.md)
**Avoids:** Pitfall 1 (auth-everywhere assumption), Pitfall 2 (no rate limiting) — rate limiting must land here, not later, per the premium-service cost constraint in `CLAUDE.md`.

### Phase 2: Anonymous Grounded Q&A + Citations
**Rationale:** The headline capability and the reason for the milestone; depends on Phase 1's session/router foundation. Citation extraction is core to acceptance criteria, not follow-on polish (Pitfall 4).
**Delivers:** Dedicated "public avatar" hosted Foundry agent (one-time provision, reusing `agent_sync_service`); `avatar_search_service.retrieve()` REST wrapper; `avatar_service.handle_turn()` orchestrator running agent-chat + citation-retrieve concurrently; SSE `text`/`citations`/`done`/`error` events; `sources-panel.tsx` rendered as a UI element separate from the avatar's speech/text; refusal/fallback behavior for no-KB-match queries; anonymous WS/token endpoint scoped to exactly one allow-listed agent (never accepts client-supplied `hcp_profile_id`).
**Uses:** Azure AI Search `retrieve` REST action, `httpx`, existing `agent_chat_service.stream_agent_response()` (reused unchanged)
**Implements:** "Dual-query citation shadow" pattern (ARCHITECTURE.md Pattern 1)
**Avoids:** Pitfall 3 (WS scope leakage), Pitfall 4 (missing citation extraction)

### Phase 3: Personalized CRM-Excel Avatar
**Rationale:** Independent of Phases 1–2's anonymous plumbing except for sharing the same `avatar_service.handle_turn()` orchestrator and hosted agent; can be developed in parallel with Phase 2 once Phase 1's foundation exists. Login-gating already exists (v1.0 Phase 1 JWT auth), so this phase is additive.
**Delivers:** `CrmProfileMapping` (`CrmMappingImport`+`CrmMappingRow`) models + migration; `crm_mapping_service.py` Excel ingestion (admin upload, pattern-borrowed from `material_service.py`); `personalization_service.py` per-user context-message builder with sanitization/allowlisting of preference values; minimal additive `extra_input` param on `agent_chat_service._build_openai_request()`; authenticated `avatar.py` router.
**Addresses:** "Login-gated personalized mode" + "Preference injection via system prompt" (FEATURES.md P1 items)
**Avoids:** Pitfall 5 (prompt injection / PII exposure) — must design sanitization into the ingestion/injection pipeline from the start, not retrofit.

### Phase 4: Spanish (es) i18n
**Rationale:** Orthogonal to the chat architecture — can land on any tier without blocking, per the research, but is scoped as its own phase because of the hidden-gap risk of i18next's silent fallback (Pitfall 6). Best sequenced once UI shells from Phases 2–3 exist so there's real content to translate, but has no hard technical dependency.
**Delivers:** `es-ES` (or a single decided code, e.g. `es-ES` vs `es-MX`) added to `supportedLngs`; full namespace-parity JSON translation set; automated CI key-parity check across `en-US`/`zh-CN`/`es-ES`; updated `i18n-switching.spec.ts` and any other hardcoded 2-locale assertions; `User.preferred_language` enum/default updated.
**Addresses:** "UI language selector covering zh-CN/en-US/es" (table stakes)
**Avoids:** Pitfall 6 (hardcoded 2-locale assumptions, silent fallback masking gaps)

### Phase 5: Clean UI — Hide Legacy Coach Entrance
**Rationale:** Sequenced last so nav-visibility changes don't collide with in-flight route additions from Phases 1–4; also lets Phase 5 exercise the full existing E2E suite as a regression check against the completed new surfaces.
**Delivers:** `feature_coach_nav_visible` flag (mirroring existing `feature_*` config pattern); nav-link-only hiding in `UserLayout`/`AdminLayout`; explicit confirmation that no route guards were touched; full existing Playwright suite re-run with zero new failures.
**Addresses:** "Clean UI: only digital human + document links visible" (table stakes)
**Avoids:** Pitfall 7 (over-scoping "hide" into route removal, breaking the large legacy E2E suite)

### Phase Ordering Rationale

- Phase 1 must come first because it resolves a structural assumption (auth-everywhere) that every other anonymous-mode feature depends on, and because rate limiting is a hard blocker per the premium-service budget constraint, not deferrable polish.
- Phases 2 and 3 share the same orchestrator/agent-chat reuse but are otherwise independent bounded contexts (anonymous vs. personalized) — they can be parallelized by different engineers once Phase 1 lands, though citation extraction logic built in Phase 2 should be reused as-is in Phase 3 if personalized mode also needs citations.
- Phase 4 (i18n) is architecturally decoupled and could technically run in parallel with Phases 2–3, but is kept as its own phase to force the completeness-check tooling to be built deliberately rather than as trailing cleanup.
- Phase 5 is last by design — legacy-entrance hiding is a pure nav/routing change that has no technical dependency on the other phases but benefits from being the final regression gate against the full existing E2E suite once all new surfaces exist.
- Every phase carries the cross-cutting coverage-gate discipline (Pitfall 8: the repo enforces `--cov-fail-under=89` aggregate) — tests must be written alongside each phase's code, not batched at the end.

### Research Flags

Needs deeper research during phase planning:
- **Phase 1 / Phase 2:** Whether the live Foundry IQ index's `sourceDataFields` actually project a document URL + page number (unverified per STACK.md Gaps) — inspect the actual index schema before committing to the citation UI's "clickable link" acceptance criterion.
- **Phase 2:** Exact shape of the Responses API's tool-call/tool-result stream events for `knowledge_base_retrieve`, and whether `azure-search-documents` GA (`12.0.0`) has folded in the `knowledgebases` module (only confirmed in preview `11.7.0b2`) — low priority since the recommended path is raw `httpx`, but worth a five-minute check.
- **Phase 3 / Phase 4:** Avatar-level (not just plain-TTS) Spanish locale support and whether mid-session language switching requires a Voice Live reconnect — flagged MEDIUM/LOW confidence in FEATURES.md; needs a targeted check before promising a live language switch, otherwise ship "switch = new session" for v1.

Phases with standard, well-documented patterns (research-phase likely unnecessary):
- **Phase 1:** Public route + feature-flag endpoint follows established FastAPI/React patterns already used elsewhere in this repo (mirrors `voice_live.py` router structure minus auth).
- **Phase 3:** Excel ingestion directly mirrors the existing `material_service.py` upload/versioning pattern.
- **Phase 4:** i18next locale addition is purely additive content work against an already-integrated framework.
- **Phase 5:** Feature-flag-gated nav visibility directly mirrors existing `feature_*` settings in `backend/app/config.py`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Citation architecture verified against current Microsoft Learn docs (updated within the last week); the specific index-schema question (does the live KB project a URL/page field) is explicitly unverified and flagged as a pre-implementation gap, not a stack-choice uncertainty. |
| Features | MEDIUM-HIGH | Azure/Foundry mechanics verified against official docs and direct repo inspection (HIGH); general anonymous-session/personalization UX conventions are informed by well-established patterns but `WebSearch` was unavailable this session, so those specific claims are self-flagged LOW/MEDIUM in the source file and should get a light sanity-check during phase planning. |
| Architecture | HIGH | Entirely derived from direct, line-level codebase inspection (no external ecosystem claims made) — file/line citations for every component and pattern. |
| Pitfalls | HIGH (codebase-specific) / MEDIUM-LOW (general Azure ecosystem claims) | Codebase-specific findings (router guards, missing rate limiter, NOT NULL constraints, coverage gate) are verified by direct source reading. General Azure AI Foundry/Voice Live ecosystem claims rely on training-data knowledge because `WebSearch` returned consistent 400 errors this session — explicitly flagged for re-verification against current docs before implementation. |

**Overall confidence:** MEDIUM-HIGH — the codebase-specific findings (which drive most of the roadmap-critical decisions: session model, rate limiting, router assumptions, citation extraction gap) are all HIGH confidence from direct inspection. The residual uncertainty is concentrated in a small number of externally-verifiable facts (index schema, avatar-level Spanish support, GA SDK module inclusion) that are cheap to resolve early in the relevant phase rather than blocking roadmap creation now.

### Gaps to Address

- **Foundry IQ index schema (document URL/page field availability):** Not verified this session. Handle by inspecting the live Phase-17 index's `sourceDataFields`/semantic configuration as the first task of the anonymous-Q&A phase, before the citation UI is considered acceptance-testable.
- **`WebSearch` tool outage this session:** General industry/ecosystem claims (anonymous-session conventions, citation-panel layout conventions, Azure Voice Live Spanish avatar support) rely on official-docs fetches and training-data inference rather than live web search. Handle by doing a light validation pass with a working search tool during phase-level research for Phase 2 (citations) and Phase 4 (Spanish avatar voice), not as a blocker to starting the roadmap.
- **Avatar-level (vs. TTS-level) Spanish locale support and mid-session language-switch reconnect mechanics:** Explicitly unverified; the MVP plan already assumes the conservative fallback ("switch = new session") — confirm or relax this during Phase 4 planning.
- **`azure-search-documents` GA module coverage:** Irrelevant to the recommended `httpx`-based approach but worth a five-minute confirmation if the team later wants a typed SDK instead of raw REST calls.
- **Exact anonymous rate-limit thresholds and whether this surface will be public-internet-facing vs. intranet-only:** Not a research gap so much as a product decision needed before Phase 1 — affects whether bot-defense (CAPTCHA/WAF) is in scope for this milestone or deferred.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection across all four research files: `backend/app/models/session.py`, `backend/app/models/hcp_knowledge_config.py`, `backend/app/services/agent_chat_service.py`, `backend/app/services/knowledge_base_service.py`, `backend/app/services/agent_sync_service.py`, `backend/app/services/material_service.py`, `backend/app/api/voice_live.py`, `backend/app/api/sessions.py`, `backend/app/dependencies.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/pyproject.toml`, `frontend/src/router/index.tsx`, `frontend/src/contexts/config-context.tsx`, `frontend/src/i18n/index.ts`, `frontend/src/hooks/use-sse.ts`, `frontend/e2e/i18n-switching.spec.ts`, `.planning/PROJECT.md`, `CLAUDE.md`
- [What is Foundry IQ? — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq) (updated 2026-07-28)
- [Query Knowledge Base via API or MCP — Azure AI Search — Microsoft Learn](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve) (updated 2026-07-24) — source of the critical MCP-tool-lacks-citations finding
- [Agentic Retrieval Overview — Azure AI Search — Microsoft Learn](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview) (updated 2026-07-02)
- [Using your data with Azure OpenAI (On Your Data, deprecated) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/concepts/use-your-data)
- [How to use Grounding with Bing Search in Foundry Agent Service — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry-classic/agents/how-to/tools-classic/bing-grounding) — source of citation display-separation requirement
- [Text to speech avatar overview — Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar)
- [Speech service language support (TTS) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
- PyPI registry (live query): `slowapi` 0.1.10, `openpyxl` 3.1.5, `azure-search-documents` 12.0.0 GA / 11.7.0b2 preview

### Secondary (MEDIUM confidence)
- [Azure-Samples/azure-search-openai-demo — GitHub](https://github.com/Azure-Samples/azure-search-openai-demo) — confirmed citation-rendering behavior in general terms; exact panel UX not verifiable from README alone

### Tertiary (LOW confidence, flagged for re-verification)
- General anonymous-session/personalization UX conventions (FEATURES.md) — `WebSearch` unavailable this session
- Azure AI Foundry Agents Responses API citation/annotation event shapes (PITFALLS.md) — training-data inference, not confirmed against current docs
- Azure Voice Live premium pricing and typical anonymous-abuse patterns (PITFALLS.md) — training-data inference
- Avatar-level (vs. TTS) Spanish locale support and mid-session language-switch reconnect mechanics (FEATURES.md/ARCHITECTURE.md) — explicitly unverified

---
*Research completed: 2026-07-31*
*Ready for roadmap: yes*
