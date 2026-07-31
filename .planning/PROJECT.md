# AI Avatar Platform — BeiGene

## What This Is

An AI-powered digital human (avatar) platform for BeiGene (百济神州), built on Azure PaaS. It provides an anonymous, no-login mode where the avatar answers questions grounded in official website content indexed into Azure AI Foundry IQ, and a personalized, login-required mode where the avatar responds using CRM-derived user profile data (POC: Excel-based mapping, no live CRM integration) and remembers user preferences injected via system prompt/template. Supports Chinese, English, and Spanish, with a clean UI showing only the digital human plus source document links.

## Core Value

Visitors and logged-in users get instant, accurate, multi-language answers from a digital human grounded in trusted knowledge sources — anonymous users draw from public site content, logged-in users get personalized answers shaped by their own profile and preferences.

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

### Active

- [ ] F2F HCP coaching with chat and voice interaction
- [ ] Conference presentation mode with virtual HCP audience
- [ ] Multi-dimensional scoring and feedback system
- [ ] Training session lifecycle management
- [ ] HCP profile configuration (personality, knowledge, interaction rules)
- [ ] Scenario management (products, key messages, scoring weights)
- [ ] Training material management (upload, versioning, retention)
- [ ] Personal and organizational reports/dashboards
- [ ] Azure OpenAI integration (GPT-4o + Realtime model)
- [ ] Azure Speech Services (STT/TTS)
- [ ] Azure AI Avatar (digital human for HCP)
- [ ] Azure Content Understanding (multimodal evaluation)
- [ ] Azure service configuration UI

### Out of Scope

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
*Last updated: 2026-07-20 after Phase 30 completion — Scenario API D-10 VoiceLiveInstance propagation fix (scenario responses now nest hcp_profile.voice_live_instance instead of hardcoded flat avatar defaults, stray flat avatar_enabled removed from frontend HcpProfile type, voice/digital-human mode gating restored in training.tsx + scenario-group-run.tsx with new gating test matrix, verified 13/13 must-haves incl. real-browser avatar rendering check)*
