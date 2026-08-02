# AI Avatar Platform — BeiGene

## What This Is

An AI-powered digital human (avatar) platform for BeiGene (百济神州), built on Azure PaaS. It provides an anonymous, no-login mode where the avatar answers questions grounded in official website content indexed into Azure AI Foundry IQ, and a personalized, login-required mode where the avatar responds using CRM-derived user profile data (POC: Excel-based mapping, no live CRM integration) and remembers user preferences injected via system prompt/template. Supports Chinese, English, and Spanish, with a clean UI showing only the digital human plus source document links.

## Core Value

Visitors and logged-in users get instant, accurate, multi-language answers from a digital human grounded in trusted knowledge sources — anonymous users draw from public site content, logged-in users get personalized answers shaped by their own profile and preferences.

## Current Milestone: v2.0 Avatar MVP

**Goal:** 将平台从 MR 教练系统转型为 AI Avatar 助手 — 匿名用户可与数字人对话获取官网知识解答，登录用户获得基于 CRM 数据（Excel POC）的个性化回答，支持西班牙语，UI 只呈现数字人 + 文档来源链接。

**Target features:**
- 匿名官网知识问答 — 无需登录，数字人基于官网内容（Foundry IQ 索引）回答问题，回答附来源（page + document link）
- 登录个性化 avatar — 基于 userid 的 CRM 知识（Excel 对应关系表 POC，不做 CRM 集成）+ 用户偏好注入（system prompt / prompt template），偏好由后台抽取或人工打标签
- 西班牙语支持 — 在现有 zh-CN/en-US 基础上新增 es
- 清爽 UI — 仅数字人 + 文档链接；语音内容与文档展示分离；隐藏旧 coach 功能入口（代码保留）

**Key context:**
- 最大化复用 v1.0 底座：Voice Live 数字人（SDK 1.3.0b1 双路径）、Foundry IQ 集成（Phase 17）、i18n 框架、JWT 认证
- 旧 coach 功能本里程碑仅隐藏前端入口、保留代码；彻底删除留到后续里程碑
- Phase 编号从 32 继续（v1.0 未正式归档，不重置编号）
- 执行遵循 CLAUDE.md 最高优先级规则：逐个需求 实现 → 100% unit test → Playwright E2E → 全通过 → commit → push

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

### Active

（无 — v2.0 Avatar MVP 全部 12 项需求已验证完成）

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
*Last updated: 2026-08-01 — Phase 33 complete (登录个性化: Excel CRM 导入 + chat-time 注入 + 管理员偏好打标签)；下一阶段 Phase 34 西班牙语 i18n*
