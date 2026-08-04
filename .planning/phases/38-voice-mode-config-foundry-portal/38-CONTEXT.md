# Phase 38: Voice Mode Config (Foundry Portal Style) - Context

**Gathered:** 2026-08-04 (rescoped same day per user)
**Status:** Ready for planning
**Source:** Debug session `avatar-persona-voice-mode-config` + user rescope decision (2026-08-04)

<domain>
## Phase Boundary

User's exact rescope statement (2026-08-04): "我说了只需要把这个图片对应的 voice instance 换成最新ai foundary portal的" — ONLY replace the "Voice Live Instance" selection card with the latest AI Foundry portal voice-mode direct configuration. Confirmed via follow-up questions:
- **Target pages: BOTH** — HCP profile editor (保存档案, "语音和数字人" tab) AND persona editor (`/admin/avatar-personas` → `persona-editor.tsx`)
- **Scope: ONLY this replacement.** The previously drafted Persona Editor Foundry Parity requirements (PEDIT-01..06, BRAND-01) are DEFERRED to Future Requirements — do not implement Foundry agent sync panels, knowledge-base attach UI, auto-instructions, workbench live test, voice/language linkage, or rebranding in this phase.

In scope: remove the HCP page's "Voice Live Instance" card; in its place render Foundry-portal-style direct voice-mode config (model deployment, Language, Speech output voice, Avatar toggle + character gallery); persist that config on the HCP profile (migration as needed); make HCP voice sessions consume the direct config instead of a pre-provisioned Voice Live instance; align the persona editor to the same portal-style components/layout (it already configures voice mode directly — no instance selector to remove there).
Out of scope: everything in the deferred PEDIT/BRAND list; changing session transport/mechanics beyond sourcing config from the profile/persona fields.
</domain>

<decisions>
## Implementation Decisions

### VMODE-01 — HCP 档案编辑页替换
- Remove the "Voice Live Instance" card (currently shows instance name e.g. `VL-female-video-zh-CN-realtime-01` with badges gpt-4o / zh-CN-XiaoxiaoMultilingualNeural / lisa · casual-sitting, a selector dropdown, and "Manage in Voice Live" link — user screenshot #14)
- Replace with Foundry-portal-style direct config (user screenshot #15, agent playground): Model deployment dropdown, Language dropdown (e.g. zh-CN), Speech output → Voice dropdown (e.g. Xiaoxiao Multilingual), Avatar toggle + character gallery (Lisa/Harry/Meg/Max standard characters with preview images + style)
- The direct config MUST be persisted on the HCP profile (Alembic migration if fields missing) and MUST be what HCP voice sessions actually use — the pre-provisioned Voice Live instance dependency goes away for session config
- Existing HCP data: planner decides migration/backfill approach (e.g. derive direct fields from the currently linked instance where possible)

### VMODE-02 — Persona 编辑页对齐
- Persona editor adopts the SAME portal-style voice-mode config presentation (shared components where practical): Speech output section, Avatar character gallery with preview images (persona editor currently uses character/style selects without gallery), Language dropdown
- Persona editor has no instance selector — this is a layout/component alignment, not a removal
- Persona save/session wiring already exists (Phases 36/37) — reuse; only the config UI presentation changes

### Constraints
- Azure Voice Live standard avatars only (prebuilt characters, e.g. Lisa/Harry/Meg/Max + styles); no custom avatar training
- CLAUDE.md top-priority rule applies: one requirement at a time → 100% unit test → Playwright E2E → all pass → commit → push
- Alembic migration mandatory for schema changes; SQLite batch mode
- 5-locale i18n parity for any new UI strings (en-US, zh-CN, es-ES, es-MX, es-US)

### Claude's Discretion
- Which fields need persisting on HcpProfile vs already exist (investigate current Voice Live instance wiring — how sessions read model/voice/avatar today)
- Shared component boundaries between HCP and persona editors
- Avatar gallery preview image sourcing (static assets vs Azure catalog)
- Migration/backfill strategy for existing HCP profiles bound to instances
</decisions>

<canonical_refs>
## Canonical References

### Current implementations to modify
- HCP profile editor "语音和数字人" tab + `agent-config-left-panel.tsx` (grep `frontend/src` — contains the Voice Live Instance card to remove)
- `frontend/src/pages/admin/persona-editor.tsx` — persona editor (5-Card layout from debug rebuild; align Speech/Avatar/Language presentation)
- Backend: HCP profile model + Voice Live instance linkage + how voice sessions build session_config (grep backend for voice live instance usage; Phase 28 wiring)
- Phase 37 persona session config wiring (character/style/voice/instructions) — the pattern for direct-config sessions already proven for personas

### Research (from broader pre-rescope scope — read selectively)
- `.planning/phases/38-voice-mode-config-foundry-portal/38-RESEARCH.md` — sections on model deployment (Q3), voice catalog (Q6), persona editor structure (Q8) remain relevant; Foundry-agent/knowledge/auto-instructions sections are now out of scope. NOTE: research did NOT cover how HCP sessions consume the Voice Live instance — planner must investigate that in-code.

### Prior phase context
- `.planning/phases/37-persona-fidelity-hardening/` — persona session config direct wiring
- `.planning/debug/avatar-persona-voice-mode-config.md` — persona editor rebuild evidence
</canonical_refs>

<specifics>
## Specific Ideas

- Screenshot #14 (HCP page): "Voice Live Instance" card — instance `VL-female-video-zh-CN-realtime-01`, badges `gpt-4o`, `zh-CN-XiaoxiaoMultilingualNeural`, `lisa · casual-sitting`, selector + ✕, "Manage in Voice Live" link. THIS is what gets removed.
- Screenshot #15 (Foundry portal playground, the target style): Model `gpt-5.4-mini` dropdown; Voice mode toggle; Instructions; Tools; Knowledge; Configuration right rail with Language `zh-CN` dropdown, Speech output → Voice `Xiaoxiao Multilingual [Female]`, Interim response / Proactive engagement toggles, Avatar toggle + gallery (Lisa Casual Sitting selected, Harry, Nia, Camila, Gabrielle, Matteo, "More avatars"). Only the voice-mode config elements (model, language, speech output voice, avatar gallery) are in scope — Tools/Knowledge/Memory/Guardrail belong to the deferred PEDIT work.
</specifics>

<deferred>
## Deferred Ideas (moved to Future Requirements 2026-08-04)

- PEDIT-01 Foundry agent sync + status panel (Agent Synced / Agent ID / Force re-sync / View in Azure Portal)
- PEDIT-02 Persona knowledge base attachment (Foundry IQ)
- PEDIT-03 standalone AvatarPersona model-deployment persistence (if VMODE needs a model field to make direct config work, implement it as part of VMODE)
- PEDIT-04 auto-generated instructions with regenerate
- PEDIT-05 workbench live test ("开始" button)
- PEDIT-06 voice/language linkage + Spanish voices
- BRAND-01 AI Coach → AI Avatar rebranding
</deferred>

---

*Phase: 38-voice-mode-config-foundry-portal*
*Context gathered: 2026-08-04 (rescoped)*
