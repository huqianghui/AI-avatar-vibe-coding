# Roadmap: AI Avatar Platform (BeiGene)

## Milestones

- ✅ **v1.0 MR Coach Platform** - Phases 1-31 (shipped; not formally archived, see PROJECT.md)
- ✅ **v2.0 Avatar MVP** - Phases 32-35 (complete 2026-08-02)
- ✅ **v2.1 Avatar Persona & Post-Login Experience** - Phase 36 (complete 2026-08-02)
- ✅ **v2.2 Persona Fidelity & Hardening** - Phase 37 (complete 2026-08-03)
- ✅ **v2.3 Voice Mode Config (Foundry Portal Style)** - Phase 38 (shipped 2026-08-05, archived to milestones/v2.3-ROADMAP.md)
- 📋 **v3.0 Fluent UI v9 Migration** - Phases 39-42 (in progress, started 2026-08-06)

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
- [x] **Phase 34: Spanish (es) i18n** - Full UI translation parity and Spanish neural voice for the avatar (completed 2026-08-01)
- [x] **Phase 35: Clean Avatar UI & Legacy Coach Hiding** - Avatar page shows only digital human + source links; legacy coach nav hidden behind a feature flag (completed 2026-08-02)

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
**Plans:** 10/10 plans complete
Plans:
- [x] 34-01-PLAN.md — i18n contract wave: supportedLngs to 5 locales (D-10), 5-option switcher, common.json translated, global locale-parity test + whitelist
- [x] 34-02-PLAN.md — Translate admin.json, voice.json, avatar.json into es-ES/es-MX/es-US
- [x] 34-03-PLAN.md — Translate analytics.json, dashboard.json, nav.json, training.json, scoring.json, conference.json into es-ES/es-MX/es-US
- [x] 34-04-PLAN.md — Translate session.json, skill.json, meta-skill.json, auth.json, coach.json, prompts.json into es-ES/es-MX/es-US
- [x] 34-05-PLAN.md — LANG-01 closing gate: full parity suite green, settings.tsx 5-option Select, Playwright switcher E2E
- [x] 34-06-PLAN.md — Backend voice unblock: widen WebrtcSessionRequest.locale, locale-aware default-voice fallback, es-* REFUSAL_TEMPLATES
- [x] 34-07-PLAN.md — Fix anonymous text-chat locale-forwarding gap end-to-end (backend ChatRequest.locale + frontend i18n.language threading)
- [x] 34-08-PLAN.md — Admin voice_map backend API (GET/PUT, role-gated) + admin.json voiceMap.* i18n keys
- [x] 34-09-PLAN.md — Admin voice_map frontend UI ("Voice per Language" Card in settings.tsx)
- [x] 34-10-PLAN.md — LANG-02 closing gate: es-* voice session E2E + full phase regression suite
**UI hint**: yes

**Requirement gate status:** LANG-01 Complete. LANG-02 Complete — es-* voice-session negotiation implemented and E2E-proven (34-10 Task 1, 5/5 green). The initial full-suite gate block (51 failures) was resolved post-plan: SplashScreen h1 collision fixed at source, stale health.spec title fixed, remaining 34 failures triaged as pre-existing legacy-coach test debt unrelated to Phase 34 (deferred-items.md addendum, tracked for Phase 35 / CLEAN-01). All 10 plans executed.

### Phase 35: Clean Avatar UI & Legacy Coach Hiding
**Goal**: The avatar experience presents a decluttered UI, and legacy coach navigation is hidden without breaking existing functionality or tests
**Depends on**: Phase 32, Phase 33 (needs both avatar surfaces to finalize layout); regression gate against full existing E2E suite
**Requirements**: AVUI-01, AVUI-02
**Success Criteria** (what must be TRUE):
  1. On the avatar page, users see only the digital human and a distinct document-links panel — no other clutter, and the avatar's voice/text content stays visually separate from the source-links panel
  2. Users no longer see legacy coach navigation entries in the app nav (feature-flag controlled), while underlying coach routes/code and the existing Playwright suite continue to work unchanged
**Plans**: 2 plans
Plans:
- [x] 35-01-PLAN.md — AVUI-01 verification lock-in: chrome-absence E2E assertion + pre-change full E2E baseline capture
- [x] 35-02-PLAN.md — AVUI-02 feature-flag pipeline: backend Settings/API + frontend type/context/UserLayout gating + full regression proof
**UI hint**: yes

### 📋 v2.1 Avatar Persona & Post-Login Experience (Phase 36)

**Milestone Goal:** 登录后直达数字人页面并加载个人记忆与已选数字人；管理员可配置数字人列表（Azure 预置 avatar + 语音 + 问候语）并标记默认；普通用户页内切换数字人并记住选择；匿名访客使用管理员标记的默认数字人。无强制选择页（默认数字人兜底）。

- [x] **Phase 36: Avatar Persona Selection & Post-Login Landing** - Admin-managed persona catalog, in-page persona switching remembered per user, post-login direct landing on the avatar page (completed 2026-08-02)

## Phase Details (v2.1)

### Phase 36: Avatar Persona Selection & Post-Login Landing

**Goal**: Logged-in users land directly on the avatar page with their memory and remembered digital-human persona loaded; admins manage a persona catalog (Azure prebuilt avatar + voice + greeting) with a marked default that also serves anonymous visitors
**Depends on**: Phase 33 (preference storage + chat-time injection), Phase 34 (voice_map/per-language voice), Phase 35 (clean avatar page as landing surface)
**Requirements**: PERSONA-01, PERSONA-02, PERSONA-03, PERSONA-04, LAND-01
**Success Criteria** (what must be TRUE):
  1. Admin can create/edit/enable/disable avatar personas (name, Azure prebuilt avatar character+style, per-language voice, greeting/persona prompt fragment) and mark exactly one enabled persona as default
  2. Anonymous visitors and logged-in users without a saved selection get the admin-marked default persona automatically — no forced selection page
  3. A logged-in user can switch persona from an in-page entry on the avatar page (switch rebuilds the session, consistent with the language-switch convention) and the choice persists as `selected_persona_id`
  4. After login, a regular user lands directly on the avatar page (`/`) with personalized memory (PERS-02 injection) and their remembered persona active; admins still land on /admin/dashboard
  5. The avatar session actually uses the active persona's character/style/voice and speaks its greeting; persona prompt fragment is injected alongside CRM/preference context with existing sanitization
**Plans**: 5 plans

Plans:
- [x] 36-01-PLAN.md — Backend AvatarPersona entity, admin CRUD API, seed default persona (PERSONA-01, PERSONA-02)
- [x] 36-02-PLAN.md — Admin frontend persona management page (Table + Dialog) (PERSONA-01, PERSONA-02)
- [x] 36-03-PLAN.md — Persona resolution wired into WebRTC session config + chat injection, two-gate sanitization (PERSONA-04)
- [x] 36-04-PLAN.md — Self-service selected-persona endpoint + PersonaSwitcher UI, session rebuild + greeting (PERSONA-03)
- [x] 36-05-PLAN.md — Post-login landing redirect to / for regular users, admin unchanged (LAND-01)

### 📋 v2.2 Persona Fidelity & Hardening (Phase 37)

**Milestone Goal:** 关闭 Phase 36 gap 分析发现的保真缺口：切换 Persona 后数字人视频形象真正变化（character/style 进 session config）、persona prompt 片段作用于语音对话通道（instructions + 双闸 sanitization）、问候语按语言（greeting per-locale map + 迁移）；并加固数据完整性（is_default DB 约束、E2E 数据清理）。

- [x] **Phase 37: Persona Fidelity & Hardening** - Persona character/style applied to avatar video rendering, prompt fragment shapes the voice channel, per-locale greeting, is_default DB constraint + E2E data hygiene (completed 2026-08-03)

## Phase Details (v2.2)

### Phase 37: Persona Fidelity & Hardening

**Goal**: A persona switch is fully observable — the on-screen digital human's visual character/style changes, the voice conversation's personality reflects the persona's prompt fragment, and the greeting is spoken in the session's language; persona data integrity is enforced at the DB level and E2E runs leave no residue
**Depends on**: Phase 36 (persona catalog, resolution, switcher), Phase 29 (Voice Live session config layer)
**Requirements**: PERSONA-05, PERSONA-06, PERSONA-07, HARD-01
**Success Criteria** (what must be TRUE):
  1. Switching persona changes the digital human's on-screen appearance — the WebRTC session config carries the active persona's Azure prebuilt character+style for both anonymous and logged-in paths
  2. The voice conversation's tone/personality follows the active persona — the Voice Live session instructions carry the sanitized persona prompt fragment (logged-in path merged with CRM/preference context, two-gate sanitization preserved)
  3. The greeting is spoken in the session's locale — greeting is a per-locale map (same mechanism as voice_map) with graceful fallback, editable per-language in the admin dialog, existing greetings preserved by migration
  4. Exactly-one-default is enforced by a DB constraint (not only the service-layer guard), and persona E2E specs clean up the personas they create (dev DB state identical before/after a full E2E run)
**Plans**: 4 plans

Plans:
- [x] 37-01-PLAN.md — Backend greeting_map column/migration + partial unique index + resolution chain + call-site fixes (PERSONA-07, HARD-01)
- [x] 37-02-PLAN.md — Avatar character/style + sanitized instructions in Voice Live session_config, optional-auth CRM merge (PERSONA-05, PERSONA-06) — backend shape-complete; live-Azure video negotiation and instructions-tone effect documented as unverified residual risks (see 37-02-SUMMARY.md)
- [x] 37-03-PLAN.md — Admin per-locale greeting editing UI + i18n parity + E2E teardown fix for admin-avatar-personas.spec.ts (PERSONA-07, HARD-01)
- [x] 37-04-PLAN.md — Landing-page avatar video transceiver negotiation + persona identity wiring + E2E identity-switch proof (PERSONA-05)

<details>
<summary>✅ v2.3 Voice Mode Config — Foundry Portal Style (Phase 38) — SHIPPED 2026-08-05</summary>

- [x] **Phase 38: Voice Mode Config (Foundry Portal Style)** (3/3 plans) — completed 2026-08-04

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

### 📋 v3.0 Fluent UI v9 Migration (Phases 39-42)

**Milestone Goal:** 将前端 UI 组件库与样式对齐 Azure AI Foundry 门户（Fluent 2 设计体系）——用适配器模式把 `@/components/ui/*` 的内部实现从 shadcn/Radix+Tailwind 逐个替换为 `@fluentui/react-components` v9，导入面与 props 签名（含 data-slot 属性）保持稳定，126 个消费文件基本不动。逐组件独立 commit，任一组件出问题直接 `git revert`。详细方案见 `.omc/plans/fluent-ui-migration-plan.md`，研究综述见 `.planning/research/SUMMARY.md`。

- [ ] **Phase 39: Fluent Infrastructure + Leaf Components** - FluentProvider + Griffel/Tailwind theme bridge lands with zero visual change, and 12 low-risk leaf components establish the adapter pattern
- [ ] **Phase 40: Composite Component Adapters** - 9 composite components (8 migrated, scroll-area kept on Radix) migrate to Fluent, closing pre-existing test-coverage gaps on select/dropdown-menu/form
- [ ] **Phase 41: Icon & Toast Adapter Layers** - 84-icon adapter and toast pub/sub bridge replace lucide-react/sonner call sites across 126/46 files, each gated by an empirical spike
- [ ] **Phase 42: Cleanup & Foundry Alignment** - Irreversible dependency uninstall + brand-ramp/a11y/Lighthouse alignment with the Foundry portal baseline (go/no-go checkpoint required)

## Phase Details (v3.0)

### Phase 39: Fluent Infrastructure + Leaf Components
**Goal**: FluentProvider is mounted with a deterministic Griffel/Tailwind theme bridge (zero visual regression), and the 12 lowest-risk leaf components run on Fluent internals while preserving the adapter contract (data-slot, asChild, event signatures) that Phase 40's composites will reuse
**Depends on**: Nothing (first v3.0 phase; builds on the existing frontend component library from v1.0-v2.3). Blocks Phase 40, Phase 41, and Phase 42 — no Fluent token resolves without FluentProvider mounted.
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, LEAF-01, LEAF-02, LEAF-03, LEAF-04, LEAF-05, LEAF-06
**Success Criteria** (what must be TRUE):
  1. `<FluentProvider>` is mounted at the App.tsx root (transparent, `className="contents"`) subscribed read-only to the existing `useThemeStore()`, and the app renders with no visual diff across all 10 pre-generated theme combinations (5 accent × light/dark) — the existing `.dark`/`.theme-*` class mechanism is untouched
  2. `npm run build` produces a `dist/index.html` where the Griffel `insertionPoint` anchor precedes Tailwind's injected stylesheet (verified by a repeatable build-check against the built artifact, not just dev mode), and a StrictMode double-render code-review gate confirms the module-scope `createDOMRenderer`/`RendererProvider` pair does not duplicate or destabilize the renderer
  3. All 12 leaf components (button, badge, input, label, checkbox, switch, separator, skeleton, progress, textarea, slider, avatar) keep identical export names, props signatures, and `data-slot` attributes; existing `*.test.tsx` suites pass with Radix `data-state` assertions rewritten to ARIA equivalents
  4. Checkbox/Switch preserve the `onCheckedChange(bool | "indeterminate")` call-site contract despite Fluent's `onChange(ev, data)` signature (including correct `"mixed"` string mapping), `asChild` continues to work via a minimal `cloneElement` shim across all consumers, and ProgressBar's 0–1 scale is correctly adapted from the existing 0–100 API without silent value scaling bugs
  5. The full pre-existing Playwright E2E suite passes with zero new failures attributable to the leaf-component swap (regression net for the rest of the milestone)
**Plans**: 7 plans
Plans:
- [x] 39-01-PLAN.md — Fluent install + Griffel/Tailwind theme bridge + FluentProvider mount (INFRA-01..04)
- [x] 39-02-PLAN.md — Button migration, establishes adapter pattern (LEAF-01)
- [x] 39-03-PLAN.md — Badge + Separator + Skeleton migration (LEAF-02)
- [x] 39-04-PLAN.md — Input + Label + Textarea migration, ref-forwarding fix (LEAF-03)
- [ ] 39-05-PLAN.md — Checkbox + Switch migration, mixed/indeterminate shim (LEAF-04)
- [ ] 39-06-PLAN.md — Progress + Slider migration, scale/shape shims (LEAF-05)
- [ ] 39-07-PLAN.md — Avatar migration, children parsing (LEAF-06)
**UI hint**: yes

### Phase 40: Composite Component Adapters
**Goal**: The 9 composite components (dialog, sheet, select, dropdown-menu, tabs, tooltip, card, form migrated; scroll-area explicitly excluded and kept on Radix) run on Fluent internals with preserved export surface and ARIA semantics, and the two highest-risk, previously-untested components (select, dropdown-menu) gain real test coverage
**Depends on**: Phase 39 (theme bridge + adapter pattern must exist first). Independent of Phase 41 (neither touches the other's code paths) — both may execute in either order once Phase 39 is done.
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):
  1. dialog, sheet, select, dropdown-menu, tabs, tooltip, card, form each keep their existing named exports and props/`data-slot` contract; scroll-area (COMP-08) remains on its current Radix implementation per the 2026-08-05 user decision, with its Radix dependency explicitly retained for Phase 42
  2. select.tsx and dropdown-menu.tsx — previously zero test coverage — have new ARIA-based test files passing and counted toward the vitest coverage thresholds; form.tsx's coverage gap is also backfilled
  3. The Sheet `side="bottom"` call site (avatar-page.tsx:446) renders correctly via Fluent `OverlayDrawer`'s native `position="bottom"` support, confirming the research correction that no custom downgrade is needed
  4. Playwright specs relying on ARIA role/name selectors (e.g. admin-azure-config.spec.ts, theme-picker visual checks) pass unchanged, proving Portal render position/z-index parity for Dialog/Sheet/DropdownMenu with zero new failures
  5. Each of the 8 migrated composites (C1–C8) is committed independently, so any single component can be `git revert`ed without affecting the others
**Plans**: TBD
**UI hint**: yes

### Phase 41: Icon & Toast Adapter Layers
**Goal**: All icon and toast usage across the app is served through dedicated adapter layers (`@fluentui/react-icons` and Fluent Toaster) with zero visual/behavioral regression in icon sizing or toast lifecycle, each rollout gated by its own empirical spike before batch work begins
**Depends on**: Phase 39 only — independent of Phase 40 (neither touches the other's code paths); may run before, after, or interleaved with Phase 40.
**Requirements**: ICON-01, ICON-02, ICON-03, TOAST-01, TOAST-02
**Success Criteria** (what must be TRUE):
  1. **Entry gate — ICON-01 spike passes first**: a pixel-diff comparison of 3–5 representative Fluent icons at multiple Tailwind `size-*` values against their lucide originals confirms `fontSize` is successfully stripped so Tailwind sizing/`currentColor` control rendering; this spike must pass before any directory-batch icon rollout starts
  2. **Entry gate — TOAST-01 spike passes first**: a live throwaway test proves `toastId` survives round-trip into `dispatchToast`/`dismissToast` (or the bridge is redesigned with an internal id-mapping layer if it doesn't); this spike must pass before the 46-file toast import migration starts
  3. All 130 icon import call sites (84 distinct icons, manually reviewed regular/filled mapping) are switched to `src/components/icons/` named exports, batched per directory (admin/shared/voice/pages) with each batch its own commit and a bundle-size comparison noted in the commit message
  4. `toast.loading()` + `toast.dismiss(id)` at avatar-page.tsx:224-243 continue to work identically through the new pub/sub bridge (`src/lib/toast/`); all 46 files' imports move from `"sonner"` to `"@/lib/toast"`, and every `vi.mock("sonner")` is individually verified as `vi.mock("@/lib/toast")` (not batch-`sed`)
  5. E2E confirms the Fluent Toaster renders a `role="status"` live region equivalent to the prior sonner behavior
**Plans**: TBD
**UI hint**: yes

### Phase 42: Cleanup & Foundry Alignment
**Goal**: Legacy Radix/lucide/sonner/vaul dependencies are safely and irreversibly removed, visual parity with the Azure AI Foundry portal is fine-tuned, and the migration's quality bar (test coverage, accessibility, performance) is confirmed at or above the pre-migration baseline
**Depends on**: Phase 39, Phase 40, and Phase 41 — ALL must be complete and verified before this phase starts. This is the one phase where the "one component = one commit, revertible" safety net is intentionally given up.
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. A zero-hit grep for `@radix-ui` (except scroll-area's retained package), `lucide-react`, `sonner`, `vaul` across `src/` is confirmed both at planning time and again immediately before the uninstall commit; the dependency removal + lockfile update is the sole irreversible commit in this milestone
  2. Brand ramp/colors visually match the Azure AI Foundry portal reference screenshots after fine-tuning, with CSS variables kept in sync with `fluent-theme.ts`
  3. Lighthouse and accessibility (a11y) audit scores are not lower than the pre-migration baseline captured before Phase 39 began
  4. Full vitest coverage and the full Playwright E2E suite pass at 100%, with dropdown-menu/select/form evaluated for removal from `coverage.exclude` and thresholds raised accordingly
**Plans**: TBD
**UI hint**: yes

> **Go/no-go checkpoint required (autonomous: false).** Phase 42 performs an irreversible dependency uninstall — do not auto-advance into this phase. Confirm Phases 39–41 are fully verified complete, then get explicit user go-ahead before executing Phase 42's plans.

## Progress

**Execution Order:**
Phases execute in numeric order: ... → 31 (v1.0 last) → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41 → 42

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-30 | v1.0 | — | Complete | see PROJECT.md |
| 31. Training Material Retention Auto-Deletion | v1.0 | 0/? | Not started | - |
| 32. Anonymous Grounded Avatar Q&A | v2.0 | 5/5 | Complete    | 2026-08-01 |
| 33. Personalized CRM-Excel Avatar | v2.0 | 8/8 | Complete    | 2026-08-01 |
| 34. Spanish (es) i18n | v2.0 | 10/10 | Complete   | 2026-08-01 |
| 35. Clean Avatar UI & Legacy Coach Hiding | v2.0 | 2/2 | Complete    | 2026-08-02 |
| 36. Avatar Persona Selection & Post-Login Landing | v2.1 | 5/5 | Complete    | 2026-08-02 |
| 37. Persona Fidelity & Hardening | v2.2 | 4/4 | Complete    | 2026-08-03 |
| 38. Voice Mode Config (Foundry Portal Style) | v2.3 | 3/3 | Complete    | 2026-08-04 |
| 39. Fluent Infrastructure + Leaf Components | v3.0 | 4/7 | In Progress|  |
| 40. Composite Component Adapters | v3.0 | 0/? | Not started | - |
| 41. Icon & Toast Adapter Layers | v3.0 | 0/? | Not started | - |
| 42. Cleanup & Foundry Alignment | v3.0 | 0/? | Not started (go/no-go gate) | - |
</content>
