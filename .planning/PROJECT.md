# AI Avatar Platform — BeiGene

## What This Is

An AI-powered digital human (avatar) platform for BeiGene (百济神州), built on Azure PaaS. It provides an anonymous, no-login mode where the avatar answers questions grounded in official website content indexed into Azure AI Foundry IQ, and a personalized, login-required mode where the avatar responds using CRM-derived user profile data (POC: Excel-based mapping, no live CRM integration) and remembers user preferences injected via system prompt/template. Supports Chinese, English, and Spanish, with a clean UI showing only the digital human plus source document links.

## Core Value

Visitors and logged-in users get instant, accurate, multi-language answers from a digital human grounded in trusted knowledge sources — anonymous users draw from public site content, logged-in users get personalized answers shaped by their own profile and preferences.

## Current State

**Shipped:** v2.3 Voice Mode Config (Foundry Portal Style) — 2026-08-05 (Phase 38, 3/3 plans, VMODE-01/02 delivered, verification 4/4 passed)

平台现状：匿名 grounded 问答 + 登录个性化（Excel CRM POC）+ 5 locale（zh-CN/en-US/es-ES/es-MX/es-US）+ Persona 目录/切换/保真 + Foundry-portal 风格 voice mode 直接配置（HCP 编辑页与 Persona 编辑页统一，HcpProfile 内联字段持久化，不再依赖预置 Voice Live 实例）。

**Known tech debt (from v2.3 code review, non-blocking):**
- WR-01: 遗留 VoiceLiveInstance CRUD 端点保留但对 HCP 语音行为已无影响（后续里程碑可清理）
- WR-02: HCP editor 测试注释中的过时 D-10 引用
- IN-01..03: 重复 "Model Deployment" 标签、`build_voice_live_metadata` 不可达 fallback 默认值、avatar_character 默认值不一致（lisa vs lori）

## Next Milestone Goals

**v2.4 Fluent UI v9 Migration（规划中）：** `@/components/ui/*` 适配器迁移（对齐 Azure AI Foundry 视觉）— 导入路径与 props 签名不变，内部实现从 Radix+Tailwind 逐个换成 `@fluentui/react-components` v9；126 个消费文件基本不动。详细方案见 `.omc/plans/fluent-ui-migration-plan.md`（阶段 A-F：Provider/主题桥接 → 叶子组件 → 复合组件 → 图标层 → Toast 桥 → 卸载 Radix/lucide/sonner）。

## Requirements

### Validated

- ✓ Project skeleton with FastAPI backend + React frontend — existing
- ✓ AI adapter subsystem with pluggable provider pattern (Azure OpenAI, Claude, Mock) — existing
- ✓ Database layer with async SQLAlchemy + Alembic migrations — existing
- ✓ Docker Compose deployment configuration — existing
- ✓ CI/CD pipeline with GitHub Actions — existing
- ✓ JWT authentication with User model, RBAC (admin/user/manager), login/me endpoints — Phase 1
- ✓ Design system with Figma Make tokens and 17 shadcn/ui components — Phase 1
- ✓ Pluggable AI service adapters (STT/TTS/Avatar) with mock implementations — Phase 1
- ✓ React SPA with i18n (zh-CN/en-US), auth store, router with guards — Phase 1
- ✓ Responsive layouts (user top-nav, admin sidebar), login page — Phase 1
- ✓ Feature toggle config API and frontend ConfigProvider — Phase 1
- ✓ F2F HCP coaching with chat and voice interaction — v1.0 (Phases 2, 8, 12)
- ✓ Conference presentation mode with virtual HCP audience — v1.0 (Phase 6)
- ✓ Multi-dimensional scoring and feedback system — v1.0 (Phases 3, 21, 26)
- ✓ Training session lifecycle management — v1.0 (Phases 2, 23–25)
- ✓ HCP profile configuration (personality, knowledge, interaction rules) — v1.0 (Phases 11–15)
- ✓ Scenario management (products, key messages, scoring weights) — v1.0 (Phases 2, 22)
- ✓ Training material management (upload, versioning, retention) — v1.0 (Phases 5, 18, 31)
- ✓ Personal and organizational reports/dashboards — v1.0 (Phase 4)
- ✓ Azure OpenAI integration (GPT-4o + Voice Live) — v1.0 (Phases 7–9, 29)
- ✓ Azure Speech Services (STT/TTS) — v1.0 (Phases 6–8)
- ✓ Azure AI Avatar (digital human) — v1.0 (Phases 8, 13, 29)
- ✓ Azure Content Understanding (voice evaluation) — v1.0 (Phases 24, 26)
- ✓ Azure service configuration UI — v1.0 (Phase 7)
- ✓ Foundry IQ knowledge base integration — v1.0 (Phase 17)
- ✓ 匿名模式：无需登录，数字人基于官网内容（Foundry IQ）回答问题，回答附来源展示（与语音分离），含限流与滥用防护 — v2.0 (Phase 32)
- ✓ 登录个性化：Excel CRM 对应关系表上传解析入库（userid → CRM 知识/对口支持人）— v2.0 (Phase 33)
- ✓ 用户偏好注入：chat-time system prompt 注入（CRM 上下文 + 偏好），含 prompt-injection/PII 双闸 sanitization — v2.0 (Phase 33)
- ✓ 管理员偏好打标签：界面查看/编辑用户偏好标签（人工打标签）— v2.0 (Phase 33)
- ✓ 西班牙语（es）i18n 支持：UI 全量 es 翻译（key-parity 校验）+ es-* neural voice 数字人语音回答 — v2.0 (Phase 34)
- ✓ 清爽 Avatar UI：avatar 页仅数字人 + 文档链接面板，语音内容与来源视觉分离，chrome-absence E2E 回归锁定 — v2.0 (Phase 35)
- ✓ 隐藏旧 coach 功能前端入口：`feature_legacy_coach_nav_enabled` flag（默认隐藏，env-only），代码与路由保留，零新增 E2E 失败 — v2.0 (Phase 35)
- ✓ 管理员数字人 Persona 目录管理（Azure 预置 avatar character+style + 按语言 voice + 问候语/prompt 片段，启用/禁用，唯一默认标记，admin CRUD + `/admin/avatar-personas` 页面）— v2.1 (Phase 36, PERSONA-01/02)
- ✓ 登录用户页内切换数字人并持久化 `selected_persona_id`（挂 Phase 33 偏好存储）；匿名与未选择用户默认 Persona 兜底，切换重建 Voice Live 会话并播报问候语 — v2.1 (Phase 36, PERSONA-03)
- ✓ avatar 会话实际应用 Persona：voice 三级回退链（persona voice_map → Phase 34 voice_map → DEFAULT_PUBLIC_VOICE_BY_LOCALE）+ greeting 下发 + persona prompt 片段双闸 sanitization 注入匿名/个性化 chat — v2.1 (Phase 36, PERSONA-04)
- ✓ 普通用户登录直达 avatar 页（`/`），admin 仍落 /admin/dashboard，`/user/dashboard` 保持可直达 — v2.1 (Phase 36, LAND-01)

- ✓ avatar 会话的数字人视频形象应用当前 Persona 的 character/style：WebRTC session config 携带 `avatar: {character, style}`，前端协商 recvonly 视频轨并展示 persona 身份（无视频轨时优雅回退 audio orb），切换后屏幕形象变化，匿名/登录一致 — v2.2 (Phase 37, PERSONA-05)
- ✓ persona prompt 片段作用于语音对话通道：Voice Live session instructions 携带 sanitized 片段，登录路径合并 CRM/偏好，复用双闸 sanitization（残留风险：agent 模式下 instructions 对语气的实际影响未经真实 Azure 验证，见 37-02-SUMMARY）— v2.2 (Phase 37, PERSONA-06)
- ✓ 问候语按语言：greeting → per-locale greeting_map（与 voice_map 同构）+ 回退链（exact → any → 默认），admin 按语言编辑，Alembic 迁移保留既有问候语 — v2.2 (Phase 37, PERSONA-07)
- ✓ 数据完整性加固：is_default partial unique index（enabled+is_default）+ persona E2E teardown（dev DB 前后字节一致，零污染）— v2.2 (Phase 37, HARD-01)

- ✓ HCP 直接 voice mode 配置：HcpProfile 新增 6 个内联字段（voice_live_model/voice_name/recognition_language/avatar_character/avatar_style/avatar_enabled，Alembic g40a 迁移 + 回填），`resolve_voice_config()` 仅从内联字段读取（21-key 输出形状不变），语音会话不再依赖预置 Voice Live 实例 — v2.3 (Phase 38, VMODE-01)
- ✓ HCP 编辑页 Foundry-portal 风格配置：Voice Live Instance 卡移除，替换为 model deployment + Language + Speech output voice + avatar 开关 + AvatarCharacterGallery（共享组件 + voice-constants），5 locale 文案齐全，E2E 覆盖 — v2.3 (Phase 38, VMODE-01)
- ✓ Persona 编辑页对齐：复用共享 AvatarCharacterGallery 与 voice-constants，Speech output 分区呈现，E2E 覆盖 — v2.3 (Phase 38, VMODE-02)

### Active

- [ ] Fluent UI v9 组件库迁移（v2.4 规划中）— `@/components/ui/*` 内部实现 Radix→Fluent 适配器替换，视觉对齐 Azure AI Foundry portal，见 `.omc/plans/fluent-ui-migration-plan.md`

### Out of Scope

- CRM 系统集成 — POC 用 Excel 对应关系表，不做真实 CRM 对接
- 深度 memory 机制 — 偏好由后台抽取或人工打标签，不做自动学习记忆
- 彻底删除 coach 代码 — v2.0 仅隐藏入口，删除留到后续里程碑

- Teams Bot integration — deferred to post-MVP, architecture should allow it
- OAuth / Azure AD SSO — future, use simple auth for now
- WeChat Mini Program — future, responsive web covers mobile for now
- Multi-tenancy — single tenant per-region deployment
- Real-time video conferencing — simulated conference, not live video
- Mobile native app — responsive web-first

## Context

- **Client**: BeiGene (百济神州) — major biotech company, needs global deployment
- **Reference**: Adapted from Capgemini AI Avatar for AWS solution (see `docs/capgemini-ai-coach-solution.md`)
- **Architecture patterns**: Reuse from two reference projects:
  - ragflow-skill-orchestrator-studio (Connection management, agent adapters)
  - yoga-guru-copilot-platform (ServiceConfig dual-layer, UI components, multi-provider agents)
- **Existing codebase**: Skeleton exists but most modules are empty stubs. Starting fresh implementation, keeping the project structure.
- **Design**: Figma Design System created (Figma Make). Individual page prompts in `docs/figma-prompts/`.
- **UI reference**: Capgemini screenshots in `pdf/images/` (mobile-first, adapting to web)
- **Timeline**: Prototype needed this week (week of 2026-03-24) for client demo

## Constraints

- **Cloud**: Azure PaaS only (no AWS) — Azure OpenAI, Speech, Avatar, Content Understanding, PostgreSQL
- **i18n**: Must support Chinese + English from day 1, i18n framework required for European expansion
- **Compliance**: Per-region deployment to satisfy data residency regulations (China, EU)
- **Auth**: Simple user/admin for MVP, architecture must support Azure AD (Entra ID) later
- **Budget**: Azure AI Avatar is premium — implement as configurable option, fall back to Azure Speech TTS
- **Frontend**: Must be responsive — same app works on desktop, tablet, mobile, and Teams Tab

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Azure PaaS over AWS | Client requirement, BeiGene uses Azure | — Pending |
| Start fresh, reuse patterns | Existing code is skeleton stubs, cleaner to rebuild with proven patterns | — Pending |
| Figma-first design | User designs in Figma, code generated from Figma MCP | — Pending |
| Simple auth for MVP | Speed to demo, Azure AD integration later | — Pending |
| GPT Realtime + Speech fallback | Premium voice experience with cost fallback option | — Pending |
| i18n from day 1 | European expansion planned, retrofitting i18n is costly | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-05 after v2.3 milestone completion (archived to .planning/milestones/); next: v2.4 Fluent UI v9 Migration*
