# Roadmap: AI Avatar Platform (BeiGene)

## Milestones

- ✅ **v1.0 MR Coach Platform** - Phases 1-31 (shipped; not formally archived, see PROJECT.md)
- 📋 **v2.0 Avatar MVP** - Phases 32-35 (planned)

## Phases

**Phase Numbering:**
- Integer phases (32, 33, 34...): Planned milestone work, continuing numbering from v1.0
- Decimal phases (32.1, 32.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MR Coach Platform (Phases 1-31)</summary>

### Phase 01: Foundation, Auth, and Design System
**Goal**: A running application with login, responsive layout shell, shared component library, i18n framework, and pluggable architecture for all AI services -- the scaffold everything else builds on
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-01, UI-02, UI-07, PLAT-01, PLAT-02, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. User can log in with username/password and see a responsive app shell with sidebar navigation -- session persists across browser refresh
  2. Admin and User roles exist -- admin sees admin routes, user does not
  3. All UI text is externalized via react-i18next and the app can switch between zh-CN and en-US
  4. AI service adapters (LLM, STT, TTS, Avatar) use pluggable provider pattern -- a mock provider works end-to-end without any Azure credentials
  5. Feature toggles, Azure service endpoints, voice mode selection, and region configuration are driven by config (not hardcoded) -- changing config changes behavior without code changes
**Plans**: 5 plans (complete)

### Phase 01.1: UI Figma Alignment (INSERTED)
**Goal:** Align existing frontend with 5 Figma Make generated screens
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Depends on:** Phase 1
**Plans:** 6/6 plans complete

### Phase 02: F2F Text Coaching and Scoring
**Goal**: An MR can select a scenario, have a text-based F2F conversation with an AI HCP, and receive a multi-dimensional scored feedback report
**Depends on**: Phase 01
**Requirements**: HCP-01, HCP-02, HCP-03, HCP-04, HCP-05, COACH-01, COACH-02, COACH-03, COACH-08, COACH-09, SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, UI-03, UI-05, PLAT-03
**Plans**: 8 plans (complete)

### Phase 03: Scoring & Assessment
**Goal**: Complete scoring system with real-time coaching suggestions, post-session reports, admin-customizable rubrics
**Depends on**: Phase 02
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, COACH-08, COACH-09
**Plans**: 4 plans (complete)

### Phase 04: Dashboard & Reporting
**Goal**: MRs track improvement via personal dashboard; admins view org-level analytics with export
**Depends on**: Phase 03
**Requirements**: UI-04, UI-06, ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05
**Plans**: 6 plans (complete)

### Phase 05: Training Material Management
**Goal**: Admin uploads, versions, and manages training materials organized by product; materials feed AI knowledge base
**Depends on**: Phase 02
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03
**Plans**: 3 plans (complete)

### Phase 06: Conference Presentation Module
**Goal**: MRs practice conference presentations to multiple virtual HCP audience members
**Depends on**: Phase 02
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, COACH-04, COACH-05, COACH-06, COACH-07
**Plans**: 6 plans (complete, 2026-03-25)

### Phase 07: Azure Service Integration
**Goal**: Admin Azure config persistence, real connection testing, dynamic provider switching
**Depends on**: Phase 01
**Requirements**: PLAT-03, ARCH-05, PLAT-05
**Plans**: 4 plans (complete, 2026-03-27)

### Phase 08: Voice & Avatar Demo Integration
**Goal**: Real-time voice-based coaching with digital HCP avatar via Azure Voice Live + Avatar
**Depends on**: Phase 07
**Requirements**: COACH-04, COACH-05, COACH-07, EXT-04, PLAT-05
**Plans**: 4 plans (complete, 2026-03-28)

### Phase 09: Integration Testing with Real Azure Services
**Goal**: Unified AI Foundry config, 7 interaction modes, agent mode runtime, E2E demo validation
**Depends on**: Phase 08
**Requirements**: COACH-04, COACH-05, COACH-06, COACH-07, PLAT-03, PLAT-05
**Plans**: 5 plans (complete, 2026-03-29)

### Phase 10: UI Polish & Professional Unification
**Goal**: Comprehensive UI overhaul for professional appearance and consistency
**Depends on**: Phase 09
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Plans**: 6 plans (complete, 2026-03-29)

### Phase 11: HCP Profile Agent Integration
**Goal**: Auto-create/sync AI Foundry Agent when admin creates/updates/deletes an HCP profile
**Depends on**: Phase 10
**Requirements**: HCP-01, HCP-02, COACH-06, COACH-07, UI-06, PLAT-01, PLAT-03
**Plans**: 3 plans (complete)

### Phase 12: Voice Realtime API & Agent Mode Integration
**Goal**: Per-HCP digital persona (voice/avatar/conversation config), auto mode selection, fallback chain
**Depends on**: Phase 11
**Requirements**: VOICE-12-01..06
**Plans**: 4 plans (complete)

### Phase 13: Voice Live Instance & Agent Voice Management
**Goal**: Create/manage Voice Live instances, bind to HCP Agents, configure speech/avatar
**Depends on**: Phase 12
**Requirements**: VOICE-13-01..05
**Plans**: 3 plans (complete)

### Phase 14: HCP Agent Refactor
**Goal**: VL Instance read-only reference in HCP editor; VL Management as sole edit entry point
**Depends on**: Phase 13
**Requirements**: HCP-14-01..06
**Plans**: 4 plans (complete)

### Phase 15: HCP Editor Agent Config Center
**Goal**: HCP editor becomes Agent config center aligned with AI Foundry Agent edit experience
**Depends on**: Phase 14
**Requirements**: HCP-15-01..05
**Plans**: 3 plans (complete)

### Phase 16: Voice Live Refactor — Modularize, Agent Mode, Sync
**Goal**: Frontend Voice Live modularization; backend dual-mode WebSocket; SDK 1.2.0b5; HCP voice config synced to AI Foundry Agent
**Depends on**: Phase 15
**Requirements**: VL-16-01..06
**Plans**: 4 plans (complete)

### Phase 17: Agent Knowledge Base — Foundry IQ Integration
**Goal**: HCP Agent knowledge base management connected to Azure AI Search / Foundry IQ
**Depends on**: Phase 16
**Requirements**: KB-17-01..05
**Plans**: 3 plans (complete)

### Phase 18: Training Material Download & Preview
**Goal**: File download API + PDF online preview + DOCX/XLSX download; fix storage_url leak
**Depends on**: Phase 05
**Requirements**: MAT-18-01..04
**Plans**: 3 plans (complete, 2026-04-10)

### Phase 19: AI Avatar Skill Module
**Goal**: Skill lifecycle management, material-to-skill conversion, Skill Hub, HCP Agent skill assignment for SOP-driven training
**Depends on**: Phase 18
**Requirements**: D-01..D-27
**Plans**: 6/8 plans executed

### Phase 20: Skill Dry Run Simulation
**Goal**: AI-simulated MR-HCP dialog to validate Skill executability with coverage/issue reporting
**Depends on**: Phase 19
**Requirements**: DR-01..08
**Plans**: 5 plans (complete, 2026-04-26)

### Phase 21: Scoring Criteria Refactor
**Goal**: ScoringRubric becomes single source of truth for scoring dimensions, eliminating hardcoding
**Depends on**: Phase 03
**Requirements**: SCORE-01..05
**Plans**: 3 plans

### Phase 22: Scenarios Module Second Refactor
**Goal**: Full-page editor, i18n complete, tags system, state machine, skill_id NOT NULL
**Depends on**: Phase 21
**Requirements**: D-01..07
**Plans**: 12 plans (6 original + 6 gap closure)

### Phase 23: Complete training session with digital human
**Goal**: [To be planned]
**Depends on**: Phase 22
**Requirements**: TBD

### Phase 24: Session Skill Focus + Azure CU Evaluation
**Goal**: Thread-level SOP focus injection + Azure Content Understanding evaluation replacing LLM scoring engine
**Depends on**: Phase 23
**Requirements**: D-01..16
**Plans**: 5 plans (complete)

### Phase 25: Refactor user training pages
**Goal**: Fix scoring-feedback data display, dedupe Dashboard/Reports content
**Depends on**: Phase 24
**Requirements**: P25-01..05
**Plans**: 2 plans

### Phase 26: Voice Live WebRTC transport option
**Goal**: WebRTC as alternative real-time audio transport alongside WebSocket
**Depends on**: Phase 25
**Requirements**: D-01..11
**Plans**: 3 plans (complete, 2026-05-22)

### Phase 27: Prompt Optimizer & Unified Prompt Management
**Goal**: Sidecar prompt-optimizer + unified versioned prompt registry + admin UI
**Depends on**: Phase 21
**Requirements**: PROMPT-01..06
**Plans**: 8 plans (complete)

### Phase 28: SOP Skill registration to AI Foundry + session-time mounting
**Goal**: Register material-derived SOP Skills as Foundry entities; mount into HCP agent toolbox at session time
**Depends on**: Phase 19, Phase 24
**Requirements**: D-01..07
**Plans**: 4 plans (complete)

### Phase 29: Voice Live API Refactor & Adaptation
**Goal**: Upgrade azure-ai-voicelive SDK to 1.3.0 GA, formalize dual-path architecture, remove classic-agent/monkey-patch
**Depends on**: Phase 28
**Requirements**: D-01..16
**Plans**: 10 plans (complete)

### Phase 30: Scenario API D-10 VoiceLiveInstance Propagation Fix
**Goal**: Propagate Phase 29 column drop to scenario API; restore voice/avatar mode gating
**Depends on**: Phase 29
**Requirements**: D-10 propagation (gap closure)
**Plans**: 5 plans (complete)

### Phase 31: Training Material Retention Auto-Deletion
**Goal**: Implement automatic deletion of expired training materials (Phase 05 gap closure)
**Depends on**: Phase 05
**Requirements**: Phase 05 gap closure
**Plans**: TBD

</details>

### 📋 v2.0 Avatar MVP (Phases 32-35, Planned)

**Milestone Goal:** 将平台从 MR 教练系统转型为 AI Avatar 助手 — 匿名用户可与数字人对话获取官网知识解答（附来源引用），登录用户获得基于 CRM 数据（Excel POC）的个性化回答，支持西班牙语，UI 只呈现数字人 + 文档来源链接，旧 coach 功能入口隐藏。

- [x] **Phase 32: Anonymous Grounded Avatar Q&A** - Visitors chat with the avatar without login and get Foundry-IQ-grounded, sourced, spoken answers, with rate limiting and audit logging (completed 2026-08-01)
- [x] **Phase 33: Personalized CRM-Excel Avatar** - Logged-in users get avatar answers shaped by Excel-based CRM context and admin-managed preference tags (completed 2026-08-01)
- [ ] **Phase 34: Spanish (es) i18n** - Full UI translation parity and Spanish neural voice for the avatar
- [ ] **Phase 35: Clean Avatar UI & Legacy Coach Hiding** - Avatar page shows only digital human + source links; legacy coach nav hidden behind a feature flag

## Phase Details

### Phase 32: Anonymous Grounded Avatar Q&A
**Goal**: Anonymous visitors can converse with the avatar and receive knowledge-grounded, sourced answers safely and without abuse/cost-exposure risk
**Depends on**: Nothing (first v2.0 phase; builds on existing Voice Live/Foundry IQ base from v1.0 Phases 8, 17, 29)
**Requirements**: ANON-01, ANON-02, ANON-03, ANON-04, ANON-05
**Success Criteria** (what must be TRUE):
  1. Visitor can open the avatar page without logging in and type a question to the digital human
  2. Visitor receives a text answer grounded in official website content (Foundry IQ index) — refuses/falls back gracefully when no knowledge match exists, never fabricates
  3. Each answer displays a separate, clickable source citation (document + page/link) rendered as a distinct UI element from the answer text, not merged into one bubble
  4. Visitor can also hear the answer spoken by the Voice Live digital human (not text-only)
  5. Anonymous requests are rate-limited/quota-capped (slowapi) and every interaction is written to an audit log — no endpoint accepts a client-supplied agent/profile identifier that could reach personalized or internal content
**Plans:** 5/5 plans complete
Plans:
- [x] 32-01-PLAN.md — DB models (anonymous session, interaction log, public knowledge config) + Alembic migration; slowapi dual-key rate limiter + structured 429 handler
- [x] 32-02-PLAN.md — Anonymous session token service + citation retrieval/dual-query orchestrator + POST /public/avatar/session and /public/avatar/chat
- [x] 32-03-PLAN.md — Anonymous-token-gated WebRTC ephemeral-credential endpoint + frontend useAnonymousVoiceLive hook
- [x] 32-04-PLAN.md — Anonymous session/chat TanStack Query hooks + sources-panel/input-bar/mic-dialog components + avatar-page composition and public route wiring
- [x] 32-05-PLAN.md — Playwright E2E (text Q&A, refusal, voice-connect) + backend audit-log completeness test + human voice-verification checkpoint
**UI hint**: yes

### Phase 33: Personalized CRM-Excel Avatar
**Goal**: Logged-in users receive avatar answers personalized via CRM-derived (Excel POC) context and manually-tagged preferences
**Depends on**: Phase 32 (shares the avatar chat orchestrator/agent)
**Requirements**: PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. Admin can upload an Excel CRM mapping file (userid → CRM knowledge / preferences) and the system parses and stores it
  2. When a logged-in user asks the avatar a question, the answer reflects that user's CRM context/preferences, injected into the prompt at chat time with sanitization against prompt-injection/PII leakage
  3. Admin can view and manually edit/tag a specific user's preference labels via an admin UI
**Plans**: TBD
**UI hint**: yes

### Phase 34: Spanish (es) i18n
**Goal**: The platform fully supports Spanish across UI text and avatar voice, alongside existing zh-CN/en-US, shipped as three full locale variants (es-ES/es-MX/es-US)
**Depends on**: Phase 32 (needs avatar UI shell to translate/voice)
**Requirements**: LANG-01, LANG-02
**Success Criteria** (what must be TRUE):
  1. User can switch the UI language to Spanish and see fully translated text with no missing-key fallback gaps across all namespaces (verified by an automated key-parity check across zh-CN/en-US/es-ES/es-MX/es-US)
  2. User can select Spanish and hear the avatar respond using an es-* neural voice (mid-session language switch may rebuild the session rather than reconnect live, per MVP scope)
**Plans:** 10 plans
Plans:
- [ ] 34-01-PLAN.md — i18n contract wave: supportedLngs to 5 locales (D-10), 5-option switcher, common.json translated, global locale-parity test + whitelist
- [ ] 34-02-PLAN.md — Translate admin.json, voice.json, avatar.json into es-ES/es-MX/es-US
- [ ] 34-03-PLAN.md — Translate analytics.json, dashboard.json, nav.json, training.json, scoring.json, conference.json into es-ES/es-MX/es-US
- [ ] 34-04-PLAN.md — Translate session.json, skill.json, meta-skill.json, auth.json, coach.json, prompts.json into es-ES/es-MX/es-US
- [ ] 34-05-PLAN.md — LANG-01 closing gate: full parity suite green, settings.tsx 5-option Select, Playwright switcher E2E
- [ ] 34-06-PLAN.md — Backend voice unblock: widen WebrtcSessionRequest.locale, locale-aware default-voice fallback, es-* REFUSAL_TEMPLATES
- [ ] 34-07-PLAN.md — Fix anonymous text-chat locale-forwarding gap end-to-end (backend ChatRequest.locale + frontend i18n.language threading)
- [ ] 34-08-PLAN.md — Admin voice_map backend API (GET/PUT, role-gated) + admin.json voiceMap.* i18n keys
- [ ] 34-09-PLAN.md — Admin voice_map frontend UI ("Voice per Language" Card in settings.tsx)
- [ ] 34-10-PLAN.md — LANG-02 closing gate: es-* voice session E2E + full phase regression suite
**UI hint**: yes

### Phase 35: Clean Avatar UI & Legacy Coach Hiding
**Goal**: The avatar experience presents a decluttered UI, and legacy coach navigation is hidden without breaking existing functionality or tests
**Depends on**: Phase 32, Phase 33 (needs both avatar surfaces to finalize layout); regression gate against full existing E2E suite
**Requirements**: AVUI-01, AVUI-02
**Success Criteria** (what must be TRUE):
  1. On the avatar page, users see only the digital human and a distinct document-links panel — no other clutter, and the avatar's voice/text content stays visually separate from the source-links panel
  2. Users no longer see legacy coach navigation entries in the app nav (feature-flag controlled), while underlying coach routes/code and the existing Playwright suite continue to work unchanged
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: ... → 31 (v1.0 last) → 32 → 33 → 34 → 35

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-30 | v1.0 | — | Complete | see PROJECT.md |
| 31. Training Material Retention Auto-Deletion | v1.0 | 0/? | Not started | - |
| 32. Anonymous Grounded Avatar Q&A | v2.0 | 5/5 | Complete    | 2026-08-01 |
| 33. Personalized CRM-Excel Avatar | v2.0 | 8/8 | Complete    | 2026-08-01 |
| 34. Spanish (es) i18n | v2.0 | 0/? | Not started | - |
| 35. Clean Avatar UI & Legacy Coach Hiding | v2.0 | 0/? | Not started | - |
</content>
