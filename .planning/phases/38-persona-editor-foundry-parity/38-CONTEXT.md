# Phase 38: Persona Editor Foundry Parity - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Source:** Debug session `avatar-persona-voice-mode-config` + user decisions (2026-08-04)

<domain>
## Phase Boundary

The persona editor (`/admin/avatar-personas`, `frontend/src/pages/admin/persona-editor.tsx`) was rebuilt in the debug session to mirror the HCP profile editor's "语音和数字人" tab layout (5 Cards: Identity, Character & Avatar, Speech, Model Deployment, Instructions + right-pane workbench preview). That rebuild deliberately left several features non-functional or omitted because the persona backend lacked support. This phase makes an avatar persona a first-class Foundry-backed agent with full editor parity to HCP profiles, fixes voice/language linkage, and completes the AI Coach → AI Avatar rebrand.

In scope: backend persona↔Foundry agent sync, persona knowledge config, model deployment persistence, auto-instructions, workbench live test, voice/language linkage + Spanish voices, user-visible rebranding.
Out of scope: deleting coach business code (CLEAN-01, future), real CRM integration, Function Call tool config (HCP page itself shows "即将推出" placeholder).
</domain>

<decisions>
## Implementation Decisions

### Foundry agent 同步 (PEDIT-01)
- Saving a persona MUST create/update a corresponding AI Foundry agent, using the same provisioning mechanism HCP profiles use (reuse/generalize the existing HCP agent provisioning service — find it under backend services for phase 28)
- Persona instructions/model/knowledge changes propagate to the Foundry agent (stay in sync)

### 知识库挂载 (PEDIT-02)
- Persona-level knowledge base attachment (Foundry IQ) — backend currently hard-scopes `HcpKnowledgeConfig.hcp_profile_id` FK to `hcp_profiles.id`;需要新表或多态外键迁移（planner decides the cleaner approach, Alembic migration mandatory)
- Editor UI mirrors HCP page's "知识库与工具" card: knowledge list + 添加/删除
- Persona sessions ground answers in attached knowledge

### 模型部署持久化 (PEDIT-03)
- Add model deployment column to `AvatarPersona` (Alembic migration)
- Editor Model Deployment card becomes functional (currently informational-only with note "not yet persisted")
- The persona's agent/session actually uses the selected deployment

### 自动生成指令 (PEDIT-04)
- Auto-generate instructions from persona fields (name, character, greeting, prompt fragment 等) with "重新生成" button — same UX as HCP editor's 自动生成指令 card
- 自定义指令 textarea: when empty, auto-generated instructions are used; when filled, custom overrides

### 工作台实时试聊 (PEDIT-05)
- The currently-disabled "开始" button in the editor's right-pane preview becomes functional: admin can live-test the persona being edited (reuse existing voice session mechanism; persona's own voice/avatar/instructions/knowledge applied)

### Voice/Language 联动 (PEDIT-06)
- Voice dropdown in Speech card MUST filter by the selected language (today it shows EN-US + ZH-CN voices regardless of language — user screenshot evidence)
- Add Spanish voices for es-ES/es-MX/es-US locales (Phase 34 shipped Spanish locales but voice catalog lacks them)
- Keep the "(use default)" fallback option

### 品牌文案 (BRAND-01)
- Replace ALL user-visible "AI Coach" wording with "AI Avatar" across every locale (en-US, zh-CN, es-ES, es-MX, es-US) — page titles, nav, headings, any UI copy
- Do NOT rename code identifiers, file names, API paths, or DB values — user-visible text only

### Claude's Discretion
- Whether persona knowledge config is a new table vs polymorphic FK migration
- Auto-instructions template contents (mirror HCP generator style)
- How the workbench test session is wired (dedicated test endpoint vs reusing public session flow with persona override)
- Voice catalog data source for Spanish voices (mirror existing voice catalog structure)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Debug session (why this phase exists, evidence + file inventory)
- `.planning/debug/avatar-persona-voice-mode-config.md` — full evidence log, gaps identified, files touched in the editor rebuild

### Current editor implementation
- `frontend/src/pages/admin/persona-editor.tsx` — the rebuilt voice-mode persona editor (this phase makes its placeholders functional)
- `frontend/src/hooks/use-avatar-personas.ts` — persona query/mutation hooks

### HCP reference implementation (the parity target)
- HCP profile editor "语音和数字人" tab and its `agent-config-left-panel.tsx` (grep under `frontend/src` for it) — layout + behavior reference
- Backend HCP agent provisioning + `HcpKnowledgeConfig` (Phase 28 work, grep backend services) — the sync/knowledge mechanism to generalize

### Prior phase context
- `.planning/phases/36-avatar-persona-selection-post-login-landing/` — persona catalog/CRUD/resolution decisions
- `.planning/phases/37-persona-fidelity-hardening/` — session config wiring (character/style/instructions/greeting_map)
- `.planning/phases/34-spanish-es-i18n/` — Spanish locale conventions (voice_map, locale files)
</canonical_refs>

<specifics>
## Specific Ideas

- User screenshot (2026-08-04) shows the Speech card's Voice dropdown listing "Ava (EN-US), Ava HD (EN-US), Andrew (EN-US), Jenny (EN-US), Xiaoxiao Multilingual (ZH-CN), Xiaoxiao (ZH-CN), Yunxi (ZH-CN), Yunjian (ZH-CN)" while Language = English — no Spanish voices, no language filtering. Both must be fixed.
- User's reference for the overall experience: Azure AI Foundry agent playground voice-mode config (model, instructions, knowledge, speech output, avatar gallery) and the HCP profile editor page ("保存档案" with 基本信息/语音和数字人 tabs).
</specifics>

<deferred>
## Deferred Ideas

- Function Call tool configuration (HCP page shows "即将推出" placeholder — keep placeholder)
- Deleting legacy coach code (CLEAN-01 — rebrand text only in this phase)
</deferred>

---

*Phase: 38-persona-editor-foundry-parity*
*Context gathered: 2026-08-04*
