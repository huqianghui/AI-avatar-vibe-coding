# Feature Landscape

**Domain:** AI-powered pharma Medical Representative training platform (HCP simulation)
**Client:** BeiGene (pharma/biotech, global operations: China + Europe)
**Researched:** 2026-03-24
**Overall confidence:** HIGH (based on Capgemini reference solution, existing requirements, Quantified.ai competitor analysis, and pharma L&D domain knowledge)

---

## Table Stakes

Features users expect. Missing any of these and the product feels incomplete or loses to competitors like Quantified.ai, Capgemini's own AWS offering, or in-house corporate L&D tools.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| TS-1 | **F2F HCP Chat Simulation** | Core value proposition. Text-based conversation with AI playing an HCP. Without this, there is no product. | High | LLM-powered role-play with scenario context, HCP personality, objection handling. FR-2.1 through FR-2.5. |
| TS-2 | **Voice Input (STT)** | MRs practice speaking, not typing. Pharma reps spend their days talking. Text-only is a toy, not a training tool. | Medium | Azure Speech STT. Must support zh-CN and en-US. FR-2.3. |
| TS-3 | **Voice Output (TTS)** | HCP must "speak back" for realistic simulation. Text-only response breaks immersion. | Medium | Azure Speech TTS with natural-sounding voices. Chinese and English voices required. FR-2.5. |
| TS-4 | **Multi-dimensional Scoring** | MRs need measurable improvement, managers need data. A single pass/fail score provides no coaching value. | High | 5-6 dimensions: key message delivery, objection handling, communication skills, product knowledge, scientific information. FR-4.1, FR-4.6. |
| TS-5 | **Post-session Feedback Report** | Without specific, actionable feedback tied to conversation moments, scoring is meaningless. MRs need to know WHAT to improve. | Medium | Strengths/weaknesses per dimension, specific quotes from conversation, improvement suggestions. FR-4.3 through FR-4.5. |
| TS-6 | **Scenario Management** | Different products, different HCPs, different difficulty levels. A single hardcoded scenario is a demo, not a platform. | Medium | Admin creates/edits scenarios with product, HCP profile, key messages, scoring weights. FR-6.6. |
| TS-7 | **HCP Profile Configuration** | Each HCP behaves differently. A "one-personality-fits-all" AI is not realistic training. Skeptical oncologists behave differently from friendly GPs. | Medium | Personality type, emotional state, communication style, knowledge background, typical objections. FR-6.2, FR-6.4, FR-6.5. |
| TS-8 | **Session History** | MRs must review past sessions to track improvement. Managers need audit trails. | Low | List of past sessions with date, scenario, score, duration. Ability to view details. FR-2.6. |
| TS-9 | **User Authentication** | Multi-user platform requires identity. Scores belong to individuals. | Low | Simple username/password for MVP. Architecture must support Azure AD later. FR per PROJECT.md. |
| TS-10 | **Key Message Tracking** | The entire point of MR training is delivering key messages. The platform must track which messages were delivered and which were missed. | Medium | Checklist of key messages per scenario, real-time tracking during session, reflected in scoring. FR-2.7. |
| TS-11 | **i18n (Chinese + English)** | BeiGene operates in China and Europe. A Chinese-only or English-only product fails half the user base. | Medium | All UI text externalized from day 1. zh-CN and en-US at minimum. Framework must support European languages later. Per PROJECT.md constraint. |
| TS-12 | **Responsive Web Design** | MRs are mobile. They train on tablets between calls, on desktops at home. Teams Tab embedding required. | Medium | Desktop-first but must work on tablet and mobile. Same app, responsive breakpoints. Per PROJECT.md constraint. |

---

## Differentiators

Features that set this platform apart from competitors. Not expected by every user, but create competitive advantage and justify BeiGene choosing this over alternatives.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D-1 | **Azure AI Avatar (Digital Human)** | Visual avatar of the HCP speaking creates visceral realism that text/voice alone cannot match. Quantified.ai and most competitors do NOT have this. Capgemini reference highlights this as a key differentiator. | High | Azure AI Avatar service. Premium cost -- must be configurable (on/off, fall back to TTS-only). Budget constraint from PROJECT.md. |
| D-2 | **Conference Presentation Mode (1-to-Many)** | Most competitors only do 1-on-1 role-play. A virtual department conference with multiple HCP audience members asking questions is a unique training modality. FR-3.x. | High | Multiple virtual HCPs in audience, questions queue, live transcription, presentation slides integration. This is a separate interaction paradigm from F2F. |
| D-3 | **Real-time AI Avataring Hints** | During the conversation, the AI whispers coaching suggestions to the MR (e.g., "mention Phase III data now"). Competitors score AFTER the session; this coaches DURING. | Medium | Side panel with contextual hints. Requires secondary LLM call or prompt engineering to generate hints without disrupting the HCP conversation flow. FR-4.2. |
| D-4 | **GPT Realtime Voice (WebSocket)** | Azure OpenAI Realtime model enables true conversational voice -- speak and hear responses with <1s latency. Most competitors use sequential STT -> LLM -> TTS pipeline with noticeable delay. | High | WebSocket-based. Significantly better UX than the traditional pipeline. Falls back to STT+LLM+TTS for cost or availability. |
| D-5 | **Configurable Scoring Criteria per Scenario** | Admins set scoring dimension weights per scenario (e.g., product launch emphasizes key messages at 40%, objection-heavy scenario emphasizes handling at 35%). Competitors typically use fixed scoring models. | Medium | Weighted sliders totaling 100%, pass threshold per scenario. FR-6.3. |
| D-6 | **Organization-level Analytics & Dashboards** | Aggregate training data across BUs, regions, time periods. Identify skill gaps org-wide. Managers see who needs coaching. | Medium | Admin dashboard with histograms, heatmaps, BU comparisons, skill gap analysis. FR-5.1 through FR-5.6. |
| D-7 | **Training Material Management** | Upload product knowledge documents (PDF/Word/Excel) that feed into the AI's knowledge base for more accurate HCP simulation and scoring. | Medium | Document upload, version control, folder organization by product/therapeutic area. FR-1.1, FR-1.2. Enables RAG-style knowledge grounding. |
| D-8 | **Personalized Training Paths** | AI recommends next scenarios based on MR's weaknesses. Not random practice -- targeted improvement. | Medium | Algorithm analyzes scoring history, recommends scenarios that target weak dimensions. FR-7.5. Defer detailed implementation to post-MVP but architecture should support it. |
| D-9 | **Azure Service Configuration UI** | Admins configure all Azure service connections (OpenAI, Speech, Avatar, etc.) from the web UI with connection testing. No code deployment needed to change endpoints or models. | Low | ServiceConfig pattern from yoga-guru reference. Expandable cards with credentials, test buttons. |
| D-10 | **Per-region Deployment for Data Residency** | China and EU data stays in-region. Not just i18n -- actual separate deployments per data residency regulation. Most SaaS competitors cannot offer this to Chinese pharma. | Low (arch) | Architecture supports it from day 1. Single codebase, per-region configuration. Not multi-tenant -- single tenant per region. |

---

## Anti-Features

Features to explicitly NOT build. Each represents a common trap that wastes time, adds complexity, or misaligns with the product's purpose.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| AF-1 | **Live Video Conferencing** | This is a training simulator, not Zoom. Real-time video adds massive complexity (WebRTC, bandwidth, latency) for zero training value. The HCP is AI, not a human on camera. | Use Azure AI Avatar for visual representation. The "conference" mode simulates audience Q&A, not live video. |
| AF-2 | **Mobile Native App (iOS/Android)** | Two native codebases (or React Native) doubles development cost. The responsive web app covers mobile use cases. BeiGene's MRs have company phones with browsers. | Build responsive web app. Test on mobile Safari and Chrome. WeChat Mini Program deferred to post-MVP per PROJECT.md. |
| AF-3 | **Teams Bot Integration** | Teams Bot SDK adds significant complexity (Bot Framework, adaptive cards, auth flows). The value is in Teams Tab embedding, which is just an iframe. | Build Teams Tab (embed web app in Teams iframe). Defer full Bot integration per PROJECT.md. |
| AF-4 | **Multi-tenancy** | BeiGene is the only client. Multi-tenant architecture adds complexity to every query (tenant isolation, data partitioning) with no current customer to justify it. | Single-tenant per-region deployment. If another pharma client needs it, deploy a separate instance. |
| AF-5 | **Custom LLM Fine-tuning** | Fine-tuning GPT-4o for each therapeutic area is expensive, slow to iterate, and unnecessary. Prompt engineering with RAG (using uploaded training materials) achieves 90% of the value. | Use prompt engineering + RAG with training materials. System prompts define HCP personality. Training materials provide product knowledge context. |
| AF-6 | **Gamification (Leaderboards, Badges, Streaks)** | Pharma training is a professional compliance activity, not a game. Leaderboards create perverse incentives (gaming the system for high scores vs genuine learning). BeiGene L&D team would reject gamification. | Focus on personal improvement trends ("you improved 12% this month") and manager-facing analytics. Professional, not playful. |
| AF-7 | **Complex Role Hierarchy (DM, MSL, BU Head, Regional, etc.)** | For MVP, only two roles matter: MR (trains) and Admin (configures). Complex role hierarchies add RBAC complexity to every endpoint with minimal value. | Two roles: User (MR) and Admin. Architecture supports additional roles later via role field. Add DM role post-MVP if needed. |
| AF-8 | **Real-time Collaborative Training** | Two MRs practicing together, or DM observing live -- adds WebSocket complexity for an edge case. MRs train alone; DMs review scores after. | Post-session review and "Share with Manager" button for async DM involvement. |
| AF-9 | **Conversation Editing / Retry from Mid-point** | Allowing MRs to edit or redo parts of a conversation breaks the simulation's realism. Real HCP conversations are not rewindable. | Conversations are immutable once completed (per CLAUDE.md domain rules). MRs can "Try Again" to start a fresh session. |
| AF-10 | **OAuth/Azure AD SSO for MVP** | Adds OIDC flow complexity, token refresh logic, Azure app registration. All for a prototype demo this week. | Simple JWT auth with username/password. Architecture uses dependency injection for auth so Azure AD can be swapped in later. |

---

## Feature Dependencies

```
Authentication (TS-9)
  |
  +-- Session History (TS-8)
  |     |
  |     +-- Personal Reports (D-6 subset)
  |     +-- Organization Analytics (D-6)
  |
  +-- HCP Profile Config (TS-7) ----+
  |                                  |
  +-- Scenario Management (TS-6) ---+
  |     |                           |
  |     +-- Key Message Tracking (TS-10)
  |                                 |
  +-- Training Material Mgmt (D-7) -+--- F2F HCP Chat Simulation (TS-1)
                                    |       |
                                    |       +-- Voice Input STT (TS-2)
                                    |       +-- Voice Output TTS (TS-3)
                                    |       +-- GPT Realtime Voice (D-4)
                                    |       +-- Azure AI Avatar (D-1)
                                    |       +-- Real-time Coaching Hints (D-3)
                                    |       |
                                    |       +-- Multi-dimensional Scoring (TS-4)
                                    |             |
                                    |             +-- Post-session Feedback (TS-5)
                                    |             +-- Configurable Scoring (D-5)
                                    |
                                    +--- Conference Presentation Mode (D-2)
                                            |
                                            +-- Multi-dimensional Scoring (TS-4)
                                                  |
                                                  +-- Post-session Feedback (TS-5)

i18n (TS-11) -- cross-cutting, must be in every component from start
Responsive Design (TS-12) -- cross-cutting, CSS/layout concern from start
Azure Service Config UI (D-9) -- independent, enables all Azure services
Per-region Deployment (D-10) -- architecture/infra concern, not feature code
```

### Critical Path
The longest dependency chain is:
**Auth -> Scenario + HCP Config -> F2F Chat Simulation -> Scoring -> Feedback**

This must be built in order. Conference mode branches off after scenarios are working.

---

## MVP Recommendation

### Phase 1: Foundation (Must ship for demo)

Prioritize (in order):
1. **Authentication** (TS-9) -- gate for everything else
2. **HCP Profile Configuration** (TS-7) -- admin creates HCP profiles
3. **Scenario Management** (TS-6) -- admin creates scenarios with products, HCPs, key messages
4. **F2F HCP Chat Simulation** (TS-1) -- text-based chat with AI HCP (core value)
5. **Key Message Tracking** (TS-10) -- track which key messages MR delivered
6. **Multi-dimensional Scoring** (TS-4) -- score the session across 5 dimensions
7. **Post-session Feedback** (TS-5) -- show strengths, weaknesses, suggestions
8. **i18n framework** (TS-11) -- wire in react-i18next, externalize strings
9. **Responsive layout** (TS-12) -- CSS breakpoints working

### Phase 2: Voice & Polish

10. **Voice Input/Output** (TS-2 + TS-3) -- Azure Speech STT/TTS
11. **Real-time Coaching Hints** (D-3) -- side panel AI suggestions
12. **Session History** (TS-8) -- past sessions list
13. **Azure Service Configuration UI** (D-9) -- admin configures Azure endpoints

### Phase 3: Premium Features

14. **Azure AI Avatar** (D-1) -- digital human visual
15. **GPT Realtime Voice** (D-4) -- WebSocket low-latency voice
16. **Conference Presentation Mode** (D-2) -- 1-to-many training
17. **Training Material Management** (D-7) -- document uploads for RAG

### Phase 4: Analytics & Scale

18. **Personal Reports** (D-6 subset) -- MR performance trends
19. **Organization Analytics** (D-6) -- admin dashboards
20. **Configurable Scoring Criteria** (D-5) -- per-scenario weight adjustment
21. **Personalized Training Paths** (D-8) -- AI-recommended next scenarios

### Defer Indefinitely

- Teams Bot (AF-3)
- Mobile native app (AF-2)
- Multi-tenancy (AF-4)
- Gamification (AF-6)
- Complex role hierarchy (AF-7)
- OAuth/Azure AD (AF-10) -- add when client demands it

---

## Competitive Landscape Context

### Quantified.ai (Primary Competitor Reference)
- AI roleplay simulations with customizable personas
- Certification and audit-ready compliance
- Manager coaching analytics (4x more coaching)
- Claims 92% realism rating from users
- NO visual avatar, NO conference mode, NO real-time coaching hints
- Targets pharma, medtech, finance, insurance

### Capgemini AI Avatar (Reference Solution Being Adapted)
- AWS-based (we are re-platforming to Azure)
- F2F + Conference modes both supported
- Digital human technology highlighted as differentiator
- Multi-dimensional scoring with 5 dimensions
- Mobile-first UI (WeChat Mini Program style) -- we are adapting to web-first
- Chinese language support built-in

### BeiGene Platform Differentiators vs Market
1. **Azure AI Avatar** -- visual digital human that competitors lack
2. **Conference mode** -- unique training modality beyond 1-on-1
3. **Real-time coaching hints** -- coaching during, not just after
4. **GPT Realtime voice** -- sub-second conversational latency
5. **Per-region deployment** -- data residency compliance for China + EU
6. **Bilingual from day 1** -- not an afterthought

---

## Sources

- Capgemini AI Avatar solution document (`docs/capgemini-ai-coach-solution.md`) -- HIGH confidence, primary reference
- BeiGene project requirements (`docs/requirements.md`) -- HIGH confidence, validated with client
- Project context and constraints (`.planning/PROJECT.md`) -- HIGH confidence, team-defined
- Figma design briefs (`docs/figma-design-brief.md`, `docs/figma-prompts/`) -- HIGH confidence, defines UI features
- Reference UI screenshots (`pdf/images/`) -- HIGH confidence, Capgemini reference implementation
- Quantified.ai platform overview (https://www.quantified.ai) -- MEDIUM confidence, WebFetch of public marketing site
- Domain expertise on pharma L&D practices -- MEDIUM confidence, based on training data knowledge of pharma MR training workflows, regulatory requirements (GxP compliance, data residency), and typical enterprise L&D platform patterns
