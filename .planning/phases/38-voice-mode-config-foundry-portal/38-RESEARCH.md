# Phase 38: Persona Editor Foundry Parity - Research

**Researched:** 2026-08-04
**Domain:** Backend (FastAPI/SQLAlchemy/Azure AI Foundry Agent SDK) + Frontend (React/TanStack Query) — codebase-internal parity work
**Confidence:** HIGH (all findings verified by direct file reads/greps in this repo; no external sources used per task constraint)

## Summary

The persona editor's placeholders exist because `AvatarPersona` (Phase 36/37) is a *lightweight* catalog row — `name/character/style/voice_map/greeting_map/prompt_fragment/enabled/is_default` only — with **no** Foundry-agent concept (`agent_id`/`agent_version`/`agent_sync_status`), **no** knowledge-config relationship, and **no** model-deployment column. `HcpProfile` has all of these, but the generalization is not a simple "extract shared code" job: several HCP mechanisms are themselves HCP-typed all the way down (SQLAlchemy FK columns, service function signatures querying `HcpProfile`/`HcpKnowledgeConfig` by name), and one HCP feature this phase is asked to parity — the Model Deployment card — **is not actually functional in HCP either** (local UI state only, per a `D-14` comment in `agent-config-left-panel.tsx`: "not persisted to any hcp_profile field"). So PEDIT-03 requires *new* behavior that exceeds HCP's current capability, not a copy of it.

The lowest-risk path is: (1) add new columns to `AvatarPersona` (agent_id/agent_version/agent_sync_status/agent_sync_error/model_deployment/agent_instructions_override) via a new Alembic migration chained off the current head `f39a_persona_greeting_map_unique_default`; (2) add a **new**, separate `PersonaKnowledgeConfig` table (not a polymorphic FK migration of the existing `hcp_knowledge_configs` table) with its own thin service module that reuses the already-duck-typed, provider-agnostic helpers in `knowledge_base_service.py` (`build_search_tools`, `resolve_kb_remote_tool_connections`, `_get_knowledgebases`, `list_search_connections`, `list_indexes`); (3) write a `sync_agent_for_persona()` sibling to `sync_agent_for_profile()` in `agent_sync_service.py` that reuses the already-generic low-level `create_agent`/`update_agent` but builds persona-specific instructions/metadata instead of calling the HCP-specific `build_agent_instructions`/`build_voice_live_metadata`; (4) extend `voice_live_websocket.py`'s `_load_connection_config` with a `persona_id` branch mirroring the `hcp_profile_id` branch (agent-mode mandatory once synced, matching HCP's own D-08 pattern) for the workbench live test; (5) fix the frontend voice catalog to carry a `locale` tag and filter by `activeLocale`, adding Spanish voice entries; (6) do a literal-string-plus-locale-value rebrand pass — critically, **several "AI Coach" occurrences are hardcoded JSX strings, not i18n-driven**, so fixing only the 5 locale JSON files will miss them.

**Primary recommendation:** Treat this phase as "give `AvatarPersona` its own parallel-but-independent Foundry-agent plumbing," not "make personas reuse `HcpProfile`'s tables/FKs." Every HCP mechanism inspected here is safely reusable at the *function* level (low-level Azure SDK calls, MCP tool builders) but not at the *model/FK* level — new tables/columns scoped to `avatar_personas` avoid any risk to existing HCP data and sidestep the polymorphic-FK migration entirely.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PEDIT-01 | Persona↔Foundry agent sync | `agent_sync_service.py` — generic `create_agent`/`update_agent` reusable; `sync_agent_for_profile` is HCP-typed, needs a persona sibling |
| PEDIT-02 | Persona knowledge config | `knowledge_base_service.py` + `HcpKnowledgeConfig` — recommend new `PersonaKnowledgeConfig` table, reuse builder functions |
| PEDIT-03 | Model deployment persistence | New `AvatarPersona.model_deployment` column; note HCP's own Model Deployment UI is non-functional today — this is *new* work, not parity-copy |
| PEDIT-04 | Auto-generate instructions | `hcp_profiles.py` `/preview-instructions` + `InstructionsSection` component — stateless pattern, fully reusable structure with new persona-specific template |
| PEDIT-05 | Workbench live test | `voice_live_websocket.py` `_load_connection_config` — add `persona_id` branch mirroring `hcp_profile_id` (agent-mode mandatory) |
| PEDIT-06 | Voice/language linkage + es voices | `voice-constants.ts` `VOICE_NAME_OPTIONS` — flat list, no locale tag, not filtered anywhere (HCP doesn't filter either) |
| BRAND-01 | "AI Coach" → "AI Avatar" rebrand | Inventory below — locale JSON **and** hardcoded JSX strings both need changes |

## 1. HCP → Foundry Agent Provisioning (PEDIT-01)

**File:** `backend/app/services/agent_sync_service.py` (979 lines)

### API surface (verified by reading the file)

| Function | Signature | HCP-specific? |
|---|---|---|
| `create_agent(db, name, instructions, model=None, *, metadata=None, tools=None, endpoint_override="", key_override="")` | Line 463 | **No** — pure Azure SDK wrapper, takes plain strings/dicts. Only cosmetic HCP reference: `description=f"HCP Agent: {name}"` (line 516, 571) |
| `update_agent(db, agent_id, name, instructions, model=None, *, metadata=None, tools=None, ...)` | Line 614 | Same — generic, same cosmetic description string |
| `delete_agent(db, agent_id)` | Line 674 | No |
| `sync_agent_for_profile(db, profile, template=None, *, scenario_id=None, prefetched_endpoint=None, prefetched_key=None, prefetched_model=None)` | Line 708 | **Yes** — calls `profile.to_prompt_dict()`, `profile.agent_id`, `profile.agent_version`, `profile.name`, `knowledge_base_service.get_knowledge_configs(db, profile.id)` (HCP-typed), `build_voice_live_metadata(profile)` (expects `profile.voice_live_instance` relationship) |
| `build_agent_instructions(profile_data: dict, template=None)` | Line 55 | HCP-shaped template (`DEFAULT_AGENT_TEMPLATE` uses `specialty`, `hospital`, `personality_type`, `communication_style`, `emotional_state`, `prescribing_habits`, `concerns`, `objections`, `probe_topics` — none of which exist on `AvatarPersona`) |
| `build_voice_live_metadata(profile: object)` | Line 126 | Calls `resolve_voice_config(profile)` from `voice_live_instance_service.py`, which reads `profile.voice_live_instance` — **AvatarPersona has no such relationship; it stores voice/avatar inline as plain strings (`character`, `style`, `voice_map`)** |
| `resync_classic_agent`, `get_agent_latest_version`, `get_project_endpoint`, `_get_project_client`, `prefetch_sync_config` | — | Fully generic, reusable as-is |

### What must be generalized

1. **A new `sync_agent_for_persona(db, persona, ...)`** function, structurally mirroring `sync_agent_for_profile` (lines 708-826) but:
   - Building instructions from persona fields (name/character/style/prompt_fragment/greeting_map/active-locale greeting) via a **new** `build_persona_agent_instructions()` (see PEDIT-04 below), not `build_agent_instructions`.
   - Building voice-live metadata directly from `persona.voice_map`/`character`/`style` (no `VoiceLiveInstance` object exists for personas) — a new `build_persona_voice_live_metadata(persona, locale)` function, structurally similar to `build_voice_live_metadata` (lines 126-238) but reading persona's own inline fields instead of `resolve_voice_config()`.
   - Using `knowledge_configs = await persona_knowledge_config_service.get_knowledge_configs(db, persona.id)` (new module, see PEDIT-02) instead of `knowledge_base_service.get_knowledge_configs`.
   - Passing `persona.model_deployment` (new column, PEDIT-03) as the `model` param to `create_agent`/`update_agent`, falling back to master config default exactly like the HCP path (line 747-753).
2. The description string `f"HCP Agent: {name}"` inside `create_agent`/`update_agent` (lines 516, 571, 655) is hardcoded — **when generalizing, this should become a caller-supplied `description` param** (or keep the HCP string as default and add an explicit override) so persona agents aren't mislabeled "HCP Agent" in the Foundry Portal.

### Pitfalls

- **API Key auth cannot create brand-new agents** (lines 480-597) — only Entra ID (`DefaultAzureCredential`) can create; API Key can only update pre-created agents. This applies identically to personas — the same `_get_project_client` fallback chain is reused, no new risk, but the planner should not assume persona agent creation will "just work" in environments without `az login`/Managed Identity.
- **Azure agent metadata values are capped at 512 chars per key** (chunking logic at lines 106-123) — the persona voice-live metadata builder must reuse `_chunk_metadata_value` if the persona's config json risks exceeding 512 chars (unlikely given persona's simpler voice model, but keep the safety-check pattern from lines 219-226).
- **`sync_agent_for_profile` writes `profile.agent_version`** by side-effect (mutates the ORM object, does not commit) — callers (e.g. `hcp_profile_service`) are responsible for `db.add`/`db.commit`. The persona sibling must follow the same contract; the API layer commit path (in `admin_avatar_personas.py`'s create/update handlers) must call `await db.commit()` after the sync, mirroring `hcp_profile_service`'s pattern.

## 2. Knowledge Config (PEDIT-02)

**Model:** `backend/app/models/hcp_knowledge_config.py` (24 lines) — `HcpKnowledgeConfig`: `hcp_profile_id` (FK to `hcp_profiles.id`, CASCADE), `connection_name`, `connection_target`, `index_name`, `server_label`, `is_enabled`. `TimestampMixin` for id/created_at/updated_at.

**Service:** `backend/app/services/knowledge_base_service.py` (633 lines)
- `get_knowledge_configs(db, hcp_profile_id)` (line 232) — hardcoded `.where(HcpKnowledgeConfig.hcp_profile_id == hcp_profile_id)`.
- `add_knowledge_config(db, hcp_profile_id, ...)` (line 242) — constructs `HcpKnowledgeConfig(hcp_profile_id=hcp_profile_id, ...)`, then calls `_trigger_agent_resync(db, hcp_profile_id)`.
- `remove_knowledge_config(db, config_id)` (line 267) — reads `record.hcp_profile_id` off the deleted row, then resyncs.
- `_trigger_agent_resync(db, hcp_profile_id)` (line 592) — queries `HcpProfile.id == hcp_profile_id` directly and calls `sync_agent_for_profile`.
- `build_search_tools(configs: list[HcpKnowledgeConfig], remote_tool_map=None)` (line 522) — **duck-typed**: only reads `.is_enabled`, `.connection_target`, `.index_name`, `.server_label` off each `cfg`. A `PersonaKnowledgeConfig` object with identical field names works here with zero code changes (Python has no structural typing enforcement at runtime; the type hint is cosmetic).
- `resolve_kb_remote_tool_connections`, `list_search_connections`, `list_indexes`, `_get_knowledgebases`, `_search_auth_headers` — all provider/index-level, **not** HCP-scoped at all; fully reusable.

**API:** `backend/app/api/knowledge_base.py` — routes: `GET/POST /knowledge-base/hcp/{hcp_profile_id}/configs`, `DELETE /knowledge-base/configs/{config_id}`, plus generic `/knowledge-base/connections` and `/knowledge-base/indexes`.

**Frontend:** `frontend/src/components/admin/knowledge-tab.tsx` (129 lines) — `KnowledgeTab({ hcpId })` uses `useHcpKnowledgeConfigs(hcpId)` + `useRemoveKnowledgeConfig()` from `frontend/src/hooks/use-knowledge-base.ts`, which call `frontend/src/api/knowledge-base.ts`: `getHcpConfigs(hcpId)` → `GET /knowledge-base/hcp/${hcpId}/configs`, `addHcpConfig` → `POST /knowledge-base/hcp/${hcpId}/configs`, `removeConfig(configId)` → `DELETE /knowledge-base/configs/${configId}`. `ConnectKbDialog` (193 lines) takes `hcpId` prop for the "connect" dialog (lists connections/indexes, generic, then posts with `hcpId`).

### Recommendation: new table, NOT polymorphic FK

**Recommended: create a new `PersonaKnowledgeConfig` model/table** (mirror `HcpKnowledgeConfig`'s columns exactly: `persona_id` FK → `avatar_personas.id` CASCADE, `connection_name`, `connection_target`, `index_name`, `server_label`, `is_enabled`), plus a new thin `persona_knowledge_config_service.py` with `get_knowledge_configs(db, persona_id)`, `add_knowledge_config(db, persona_id, ...)`, `remove_knowledge_config(db, config_id)`, `_trigger_agent_resync(db, persona_id)` (calling the new `sync_agent_for_persona`). These new functions reuse `build_search_tools` and `resolve_kb_remote_tool_connections` from `knowledge_base_service.py` unchanged (pass the persona configs list straight in — duck-typing confirmed above).

**Rationale over polymorphic FK:**
- **Zero risk to existing HCP data/queries** — `hcp_knowledge_configs` table, its FK constraint, and every existing query/service function stay untouched.
- **Avoids SQLite `ALTER COLUMN`/data-backfill entirely** for the existing table (CLAUDE.md Gotcha #1: SQLite needs batch mode for `ALTER`; a polymorphic-FK migration would need to add an `owner_type` discriminator column to the *existing* table with a backfill of `owner_type='hcp'` for every current row — more moving parts, more failure surface, for zero functional gain).
- **Matches existing codebase convention** — `AvatarPersona` is already a wholly separate table from `HcpProfile` (Phase 36 chose not to unify them), so a separate `PersonaKnowledgeConfig` table is consistent, not a deviation.
- **New table + Alembic `op.create_table`** is the simplest possible migration (see `p19a_add_hcp_knowledge_configs.py` for the exact original pattern to mirror).

**Frontend:** either (a) generalize `KnowledgeTab`/`ConnectKbDialog` to accept a discriminated prop (`{ ownerType: "hcp" | "persona"; ownerId: string }`) and branch the API base path, or (b) create a parallel `PersonaKnowledgeTab` + persona-scoped hooks (`usePersonaKnowledgeConfigs`, `useAddPersonaKnowledgeConfig`) calling new `/knowledge-base/persona/{persona_id}/configs` routes. Given the component is small (129 lines) and mostly presentational, **(a) generalizing the prop is lower total surface area** than duplicating the component, but either is acceptable — this is exactly the kind of decision flagged as Claude's Discretion in CONTEXT.md; either approach is compatible with the backend recommendation above.

### Pitfalls

- `_trigger_agent_resync` currently does a **non-optional** resync — a KB failing to get an authenticated MCP connection **raises**, intentionally not swallowed (see the large comment at agent_sync_service.py lines 758-766) so a broken KB fails the whole sync loudly rather than silently producing an unauthenticated tool. The persona equivalent must preserve this fail-loud behavior, not wrap it in a broad try/except.
- `build_search_tools`'s type hint (`list[HcpKnowledgeConfig]`) should be updated to `list[HcpKnowledgeConfig | PersonaKnowledgeConfig]` or a `Protocol` for type-checker cleanliness (ruff/mypy won't complain at runtime, but `ruff check` won't catch a real signature mismatch either — this is a documentation/clarity task, not a functional blocker).

## 3. Model Deployment (PEDIT-03)

**Frontend component:** `frontend/src/components/admin/agent-foundation-model-select.tsx` — `AgentFoundationModelSelect({ value, onValueChange, disabled })`, backed by `useAgentFoundationModels()` hook → `data.models` list.

**Backend catalog:** `backend/app/services/agent_foundation_models.py` — **intentionally separate from `VOICE_LIVE_MODELS`** (`backend/app/services/voice_live_models.py`); explicitly excludes voice-live model names (`_EXCLUDED_NAMES = {k.lower() for k in VOICE_LIVE_MODELS}`, line 26). This is a chat-completion-capable Foundry Agent model catalog, distinct in purpose from the realtime Voice Live model list.

### Critical finding: HCP's own Model Deployment card is NOT persisted today

`frontend/src/components/admin/agent-config-left-panel.tsx` lines 78-81:
```
// D-14: Foundation Model selection is not part of HcpFormValues (confirmed
// by 29-07-SUMMARY.md — voice_live_model lives only on VoiceLiveInstanceSummary).
// Tracked as local UI state only; not persisted to any hcp_profile field.
const [foundationModel, setFoundationModel] = useState("");
```
`HcpProfile` (backend/app/models/hcp_profile.py) has **no** model-deployment column at all. The actual model used when `sync_agent_for_profile` creates/updates the Foundry agent is `master.model_or_deployment` (a single global admin config value, `prefetched_model` in `sync_agent_for_profile`, line 747-753) — **not** anything selected per-HCP in this card. `persona-editor.tsx` (lines 118-123) has the identical local-state-only pattern, with an explicit comment acknowledging it mirrors HCP's non-functional behavior.

**Implication for planning:** PEDIT-03 is asking for genuinely *new* capability, not a copy of an existing HCP mechanism — HCP has no working per-profile model override to copy from. The persona feature will, once built, exceed HCP's current capability.

### Recommended approach

1. **New column:** `AvatarPersona.model_deployment: Mapped[str] = mapped_column(String(100), default="")` — empty string means "use master default", mirroring the `prefetched_model` fallback chain already used for HCP (`master.model_or_deployment` → `settings.voice_live_default_model`).
2. **Frontend:** wire `AgentFoundationModelSelect`'s `value`/`onValueChange` to `form.model_deployment` (react state, persisted on Save) instead of the local-only `useState`.
3. **Backend consumption:** `sync_agent_for_persona` passes `persona.model_deployment or <master default>` as the `model` param to `create_agent`/`update_agent` (this is the actual functional wiring HCP lacks).
4. **Live-test session (PEDIT-05):** when in agent mode, Voice Live sessions consume whatever model is baked into the Foundry agent's own definition (set at `create_agent`/`update_agent` time) — there is no separate "session-time" model selection needed for personas the way `voice_live_websocket.py`'s `vc["voice_live_model"]` exists for HCP's `VoiceLiveInstance`. One field (`model_deployment`) covers both agent creation and (indirectly, via the agent) the live session — simpler than HCP's two-catalog split.

### Pitfalls

- Do not conflate `agent_foundation_models.py`'s catalog (chat-completion models, for `create_agent`'s `model=` param) with `voice_live_models.py`'s `VOICE_LIVE_MODELS` (realtime voice models, validated in `_load_connection_config`'s `hcp_profile_id`/`vl_instance_id` branches). Personas should use the **`agent_foundation_models`** catalog since the value feeds the Foundry Agent definition, not a Voice Live session directly.

## 4. Auto-Instructions (PEDIT-04)

**Backend endpoint:** `backend/app/api/hcp_profiles.py` lines 150-191 — `POST /hcp-profiles/preview-instructions`, stateless: `InstructionsPreviewRequest` (plain field echo of profile-shape fields, no DB lookup, no `profile_id` — works for **unsaved/in-progress edits**), `InstructionsPreviewResponse { instructions: str, is_override: bool }`. Handler: `build_agent_instructions(body.model_dump())`, `is_override = bool(agent_instructions_override.strip())`. Admin-role gated (`require_role("admin")`).

**Frontend:** `frontend/src/components/admin/instructions-section.tsx` (158 lines) — `InstructionsSection`:
- Auto-loads on mount via `previewInstructions(form.getValues(), abortSignal)` (line 45) from `frontend/src/api/hcp-profiles.ts` (line 117) → `POST /hcp-profiles/preview-instructions`.
- "重新生成" button re-calls `previewInstructions(...)` (line 74) with current form values.
- `overrideValue = form.watch("agent_instructions_override")` (line 89) — custom-overrides-auto pattern: textarea bound to `agent_instructions_override`; when empty, the auto-generated preview text (state `autoInstructions`) is shown/used; when the admin types into the override textarea, that value takes precedence (mirrors backend's `build_agent_instructions` override-first logic at agent_sync_service.py lines 66-69).

### Recommended approach for personas

1. **New backend endpoint** `POST /avatar-personas/preview-instructions` with a `PersonaInstructionsPreviewRequest` body (`name`, `character`, `style`, `greeting: str` — the active-locale greeting — `prompt_fragment`, `agent_instructions_override`) and identical `{instructions, is_override}` response shape.
2. **New `build_persona_agent_instructions(persona_data: dict, template=None) -> str`** in `agent_sync_service.py` (or a new small module) — override-first (mirror lines 66-69), then a persona-shaped default template built from `name`/`character`/`style`/`greeting`/`prompt_fragment` (none of HCP's `DEFAULT_AGENT_TEMPLATE` fields apply — this needs a genuinely new template string, not a reuse of `DEFAULT_AGENT_TEMPLATE`).
3. **New `agent_instructions_override` column on `AvatarPersona`** — do **not** reuse `prompt_fragment` for this. `prompt_fragment` already has an established, different consumption path: `personalized_avatar_service.py` line 52 sanitizes it and concatenates it as a `developer`-role personalization snippet ahead of CRM context in **text chat** (Phase 36/37 behavior) — a completely different mechanism from the Foundry Agent's own `instructions` field (which is what `agent_instructions_override`/auto-generated instructions feed). Conflating the two would change existing, working text-chat personalization behavior. Keep them as two independent fields.
4. **New frontend `PersonaInstructionsSection`** (or generalize `InstructionsSection` with a pluggable `previewFn`/field-mapper prop) mirroring the auto-load-on-mount + "重新生成" + override-textarea pattern.

### Pitfalls

- The stateless-preview design (no persisted profile needed) is exactly what makes "regenerate from unsaved editor state" work today for HCP — preserve this property for personas; do **not** make the persona preview endpoint require a saved `persona_id`.

## 5. Workbench Live Test (PEDIT-05)

**UI:** `frontend/src/pages/admin/persona-editor.tsx` lines 631-677 — right-pane preview `Card` with a disabled "开始"/`hcp.playgroundStart` button (Tooltip explains: "a live interactive test session requires either an assigned Voice Live instance or a Foundry agent... AvatarPersona has neither concept today").

**HCP's equivalent mechanism** (the "工作台" 开始 button target): `frontend/src/components/admin/playground-preview-panel.tsx` (222 lines) → `VoiceTestPlayground` (`frontend/src/components/voice/voice-test-playground.tsx`, ~230+ lines) → `useVoiceSessionLifecycle` (`frontend/src/hooks/use-voice-session-lifecycle.ts`) → `useVoiceLive.connect()` (`frontend/src/hooks/use-voice-live.ts`) → WebSocket → `backend/app/services/voice_live_websocket.py` `handle_voice_live_websocket` → `_load_connection_config`.

**`VoiceTestPlayground` props relevant here:** `hcpProfileId`, `vlInstanceId`, `systemPrompt`, `language`, `avatarCharacter`, `avatarStyle`, `avatarEnabled`, `hcpName` — but only `hcpProfileId`/`vlInstanceId`/`systemPrompt`/`enableAvatar`/`sessionId` are actually forwarded into `startVoiceSession` (line 141-156) → `voiceLive.connect()` (use-voice-session-lifecycle.ts lines 111-117) → WS `session.update` message (`use-voice-live.ts` lines 130-137: `hcp_profile_id`, `vl_instance_id`, `system_prompt`, `avatar_enabled`, `session_id`). **`avatarCharacter`/`avatarStyle`/`avatarEnabled` props are NOT sent over the wire today** — they're display-only for the local `AvatarView` preview before connecting; the actual character/style used once connected comes server-side from resolving `hcp_profile_id`/`vl_instance_id`.

**Backend resolution (`_load_connection_config`, `voice_live_websocket.py` lines 103-319):**
- `hcp_profile_id` branch (lines 172-257): resolves `HcpProfile`, requires `profile.agent_id` **and** `profile.agent_sync_status == "synced"` — raises `AgentSyncRequiredError` otherwise (agent mode is mandatory for HCP, no model-mode fallback, per D-08). Instructions precedence: `agent_instructions_override` → client `system_prompt` → `build_agent_instructions(profile.to_prompt_dict())`.
- `vl_instance_id` branch (lines 259-312): resolves `VoiceLiveInstance` directly, **always model-mode** (no agent, no knowledge tools) — this is HCP's "standalone VL instance test," decoupled from any HCP profile.
- `avatar_enabled` param can only *downgrade*, never upgrade, what the resolved identity permits (line 314-317).

### Recommended wiring for personas

Add a **`persona_id` branch** to `_load_connection_config`, structurally parallel to the `hcp_profile_id` branch (agent-mode mandatory once `agent_sync_status == "synced"`, raising the same `AgentSyncRequiredError`-style guard) — **not** parallel to the model-mode-only `vl_instance_id` branch. Reasoning: knowledge-base grounding (PEDIT-02) can only be attached to an agent via `kb_tools` in `create_agent`/`update_agent` (agent_sync_service.py lines 767-779); a model-mode session has no mechanism to attach KB tools. Since CONTEXT.md requires the live test to reflect "persona's own voice/avatar/instructions/**knowledge**," agent mode is required, which means:

- **The workbench Start button must require a saved+synced persona** (Save first, then Start) — exactly mirroring HCP's own UX constraint (HCP's Start button is similarly gated: `isNew` disables the VL instance selector, and agent mode requires a prior sync). This resolves the "unsaved changes vs saved-only" question raised in CONTEXT.md: **recommend saved-only**, consistent with existing precedent, rather than inventing a new unsaved-preview session path that would need to bypass the agent-mode/KB-grounding requirement entirely.
- Frontend: extend `VoiceTestPlayground`'s prop set with `personaId?: string`, threaded through `useVoiceSessionLifecycle`'s `StartSessionOptions` and `useVoiceLive`'s `connect()` options, down to a new `persona_id` key in the WS `session.update` payload (mirroring `hcp_profile_id`'s plumbing exactly at each layer: `use-voice-live.ts` line ~85/131, `use-voice-session-lifecycle.ts` line ~26/112, `voice-test-playground.tsx` line ~56/141-156).
- Backend: `session_data.get("persona_id")` alongside the existing `hcp_profile_id`/`vl_instance_id`/`system_prompt` reads (voice_live_websocket.py lines 436-440), then a new `elif persona_id:` branch in `_load_connection_config` resolving `AvatarPersona`, its `voice_map`/`greeting_map` for the *current UI language* (need a `locale`/`language` param passed alongside `persona_id`, since persona voice/greeting are per-locale — HCP has no such per-locale voice concept, so this is genuinely new plumbing, not a straight mirror), and requiring `persona.agent_sync_status == "synced"`.
- Enable the button in `persona-editor.tsx` once `persona.id` exists (i.e., not `isNew`/unsaved) and `agent_sync_status === "synced"` — same gating shape as HCP's `isNew` check (line 217-221 in `agent-config-left-panel.tsx`).

### Pitfalls

- **Training-session path** (`training_session_id`, lines 444-466) explicitly ignores all client-selected identity inputs for security ("Ignore all client-selected identity/prompt inputs on trusted training paths") — the persona test path is an **admin-authenticated, non-training** path, so it should follow the `hcp_profile_id`/`vl_instance_id` precedent (client-supplied ID, server resolves), not the training-session precedent. Do not conflate the two.
- The `AgentSyncRequiredError` class (line 67) currently hardcodes an HCP-specific message ("Voice agent is not synced for HCP profile {hcp_profile_id}") — generalize the message or add a persona-specific variant so the frontend error surface reads correctly.
- Force-model-mode override exists (`force_model_mode=True`, used for training sessions at line 521) — persona test sessions should **not** set this, since agent mode (with KB grounding) is the whole point.

## 6. Voice Catalog + Language Linkage (PEDIT-06)

**Catalog:** `frontend/src/lib/voice-constants.ts` lines 5-14 — `VOICE_NAME_OPTIONS`: flat array of `{ value, labelKey }` — **no locale/language field at all**. 8 entries: 4 `en-US-*` (Ava, Ava HD, Andrew, Jenny) + 4 `zh-CN-*` (Xiaoxiao Multilingual, Xiaoxiao, Yunxi, Yunjian). Locale is only implicit in the `value` string's prefix (e.g. `en-US-AvaNeural`).

**Does HCP filter by language?** No. `frontend/src/components/admin/vl-instance-dialog.tsx` and `frontend/src/pages/admin/vl-instance-editor.tsx` both import from the same flat `VOICE_NAME_OPTIONS` with no filtering — **HCP shows the identical unfiltered 8-voice list regardless of any language setting** (HCP's `VoiceLiveInstance` has a `recognition_language` field for ASR, but no equivalent gating on the TTS voice dropdown). This confirms the bug the user screenshotted is not persona-specific — it's the underlying shared catalog's design (no locale metadata), which HCP happens not to expose as visibly because HCP profiles don't have a per-locale voice map UI the way personas do (`activeLocale` selector at `persona-editor.tsx` line 116/491-509).

**No backend allowlist** — grepped `backend/app` for voice-name validation logic; none exists for TTS voice names (`VOICE_LIVE_MODELS` is validated, but that's the realtime *model*, not the *voice*). Adding new voice entries is a **frontend-only + locale-JSON change**; no backend enum/allowlist needs updating.

### Recommended approach

1. Add a `locale: string` field to each `VOICE_NAME_OPTIONS` entry (derive from the existing value's prefix — `"en-US-AvaNeural"` → `"en-US"`, `"zh-CN-XiaoxiaoNeural"` → `"zh-CN"`) — non-breaking for existing HCP consumers (they can keep using the flat list unfiltered, since `locale` is an additive field).
2. Add Spanish entries for `es-ES` / `es-MX` / `es-US` (matching `PERSONA_VOICE_LOCALES` at `persona-editor.tsx` line 37, which already anticipates these three locales). **`[ASSUMED]`** — exact Azure Neural voice names (e.g. `es-ES-ElviraNeural`/`es-ES-AlvaroNeural`, `es-MX-DaliaNeural`/`es-MX-JorgeNeural`, `es-US-PalomaNeural`/`es-US-AlonsoNeural`) are from training knowledge, **not verified against a current Azure Speech voice-catalog source in this session** (WebSearch/WebFetch were out of scope for this codebase-internal research task). The planner/executor should verify the exact voice names Azure currently offers for each `es-*` locale before shipping (a quick check against Azure's voice gallery/portal, or the Azure Speech SDK's voice-list API if reachable in this environment, is enough — no need for deep research, just a name-spelling confirmation).
3. In `persona-editor.tsx`, change line 525's `{VOICE_NAME_OPTIONS.map(...)}` to filter by `activeLocale` (e.g. `VOICE_NAME_OPTIONS.filter(v => v.locale === activeLocale)`), keeping the existing "(use default)" `SelectItem` (the `USE_DEFAULT_VOICE` sentinel already referenced at line 515) untouched.
4. Add corresponding `voice*` label keys + values to all 5 locale `admin.json` files (mirroring the existing `voiceAva`/`voiceXiaoxiaoMultilingual` pattern: `"voiceElvira": "Elvira (ES-ES)"`, etc.) — 3 new locales × 2 voices each ≈ 6 new label keys, added to 5 locale files each.

### Pitfalls

- Do **not** touch `VOICE_NAME_OPTIONS`'s consumption in `vl-instance-dialog.tsx`/`vl-instance-editor.tsx` (HCP path) when adding the `locale` field — those components should continue to show the unfiltered full list (adding `locale` is additive, filtering is opt-in per consumer).
- `USE_DEFAULT_VOICE` sentinel value (referenced but not fully inspected here — grep `persona-editor.tsx` for its definition before implementing) must remain selectable regardless of `activeLocale` filter — it's a fallback, not a voice.

## 7. "AI Coach" Inventory (BRAND-01)

### Locale JSON files — exact "AI Coach" / localized-equivalent phrase (verified via grep across all 5 locale dirs)

| File | Key | en-US value | zh-CN value | es-ES/es-MX/es-US value |
|---|---|---|---|---|
| `auth.json` | `title` | "AI Coach" | "AI 教练" | "Coach de IA" |
| `auth.json` | `copyright` | "2026 AI Coach Platform" | "2026 AI 教练平台" | "2026 Plataforma AI Coach" |
| `common.json` | `appName` | "AI Coach" | **"AI Coach"** (untranslated, identical across all 5 locales) | "AI Coach" |
| `training.json` | `aiCoachHints` | "AI Coach Hints" | "AI教练提示" | "Sugerencias del Coach de IA" |
| `coach.json` | `aiCoachHints` | "AI Coach Hints" | "AI 教练提示" | "Pistas del Coach de IA" |
| `admin.json` | `modelHint` | "Default model for **AI coaching** and agent creation" (generic, lowercase, describes the training/coaching feature) | "**AI 教练**和代理创建的默认模型" (uses the exact brand characters) | "Modelo predeterminado para la formación/capacitación con IA..." (generic, no brand phrase) |

**Total: 5 files × up to 6 keys, present in some form across all 5 locale directories** (`auth.json`, `common.json`, `training.json`, `coach.json`, `admin.json` for zh-CN only on the `modelHint` line — es-*/en-US `modelHint` uses generic "AI coaching" wording, not the exact brand phrase, borderline case for planner judgment).

**`common.json`'s `appName` is whitelisted as intentionally-untranslated** at `frontend/src/i18n/untranslated-whitelist.ts` line 22 (`"common.appName"`) — an i18n-completeness check presumably asserts this key is identical across locales. Since the new value ("AI Avatar") would *still* be identical across all 5 locales, **no change needed to the whitelist itself**, only to the JSON value in all 5 files.

### Hardcoded (non-i18n) occurrences — frontend/src, verified NOT to go through `t()`

| File | Line | Hardcoded string | Component already imports `useTranslation`? |
|---|---|---|---|
| `frontend/src/components/layouts/admin-layout.tsx` | 168 | `AI Coach Admin` (plain JSX text) | Yes (`tNav`, `tCommon` already in scope) |
| `frontend/src/components/layouts/admin-layout.tsx` | 227 | `<SheetTitle>AI Coach Admin</SheetTitle>` | Yes |
| `frontend/src/components/layouts/user-layout.tsx` | 83 | `<span>AI Coach</span>` | Yes |
| `frontend/src/components/layouts/user-layout.tsx` | 158 | `<SheetTitle>AI Coach</SheetTitle>` | Yes |
| `frontend/src/components/layouts/user-layout.tsx` | 193 | `2026 AI Coach Platform` | Yes |
| `frontend/src/components/layouts/auth-layout.tsx` | 12 | `{"©"} 2026 AI Coach Platform` | **No** `useTranslation` import in this file today |

These **six hardcoded occurrences will NOT be fixed by editing locale JSON files alone** — this is the single biggest risk for BRAND-01 completeness. `frontend/src/components/coach/hints-panel.tsx:78` and `frontend/src/components/coach/right-panel.tsx:96` also contain `AI Coach Hints` but as a **JSX comment** (`{/* AI Coach Hints */}`), not rendered text — out of scope per BRAND-01's "user-visible text only."

`frontend/index.html`'s `<title>` is already `"AI Avatar Platform"` — no change needed there.

### Recommendation

- **Locale JSON files:** update the 5 (or 6, pending the `modelHint` judgment call) key values in all 5 locale directories, `appName`/`title`/`copyright`/`aiCoachHints` → "AI Avatar"/"AI 化身" (or team's chosen zh-CN term)/localized equivalents. Do not rename the JSON keys themselves (`aiCoachHints` stays `aiCoachHints` — BRAND-01 explicitly forbids renaming identifiers).
- **Hardcoded strings:** simplest compliant fix is literal replacement (`AI Coach` → `AI Avatar` directly in the JSX) since these are decorative one-offs, not full i18n keys, and BRAND-01 only requires the user-visible text to change — it does not mandate converting them to `t()`-driven strings. Given `admin-layout.tsx`/`user-layout.tsx` already have `useTranslation` in scope and already use `tCommon("appName")` in the splash screen (`splash-screen.tsx` line 60), an equally valid alternative is wiring these six spots to `tCommon("appName")` (+ new small keys for the "Admin"/"Platform" suffixes) for future-proof consistency — leave this choice to the planner; either satisfies BRAND-01.
- **`auth-layout.tsx`** needs a new `useTranslation` import if the i18n-key route is chosen; the literal-string route needs no import change.
- **Scope boundary (recommend clarifying with planner/user if ambiguous):** the broader "coaching"/"教练"/"Coach" vocabulary describing the **HCP training-simulator business feature** (`coach.json`'s `coachingPanel`, `voice.json`'s "Voice Coaching Session", `admin.json`'s `instanceNamePlaceholder: "e.g. Sales Coach - Chinese Female Voice"`, etc.) is a **separate, legitimate product feature name**, not the app's own top-level brand name. CONTEXT.md's Deferred Ideas ("Deleting legacy coach code (CLEAN-01... rebrand text only in this phase)") supports scoping BRAND-01 strictly to the exact "AI Coach" brand phrase (and direct localized equivalents), not a blanket "coach"→"avatar" find-replace across the whole coaching-feature vocabulary.

## 8. Current Persona Editor State

**`frontend/src/pages/admin/persona-editor.tsx`** (680 lines) — structure (Cards, top to bottom in the left form column):
1. **Identity** — `name` input.
2. **Character & Avatar** — `character`/`style` via `AVATAR_CHARACTERS` data (`@/data/avatar-characters`), `AvatarView` live preview swap.
3. **Speech** (lines ~480-565) — `activeLocale` selector (`PERSONA_VOICE_LOCALES = ["zh-CN","en-US","es-ES","es-MX","es-US"]`, line 37) driving per-locale `voice_map`/`greeting_map` edits; Voice `Select` unfiltered over `VOICE_NAME_OPTIONS` (the PEDIT-06 bug); Greeting `Textarea`; "configured locales" badge row (line 548-561) showing which locales have overrides.
4. **Model Deployment** (lines ~570-586) — `AgentFoundationModelSelect` bound to local-only `foundationModel` state (PEDIT-03 gap, `personas.editor.modelDeploymentNote` i18n key already exists for the "not yet persisted" caption).
5. **Instructions** (`persona-editor-prompt-fragment`, lines 600-613) — plain `Textarea` bound to `form.prompt_fragment`; **no auto-generate/regenerate mechanism today** (PEDIT-04 gap) — this textarea currently *is* the only instructions input, feeding the text-chat personalization path (`personalized_avatar_service.py`), not any Foundry agent.
6. **Bottom action bar** — Save/Reset buttons; Save calls `useCreateAvatarPersona`/`useUpdateAvatarPersona` (from `use-avatar-personas.ts`) with a payload built at line ~270-280 (`{ ...form fields, voice_map: form.voiceMap, ... }`).
7. **Right panel** — static `AvatarView` preview (no live connection), disabled "开始" button with `Tooltip` explaining the gap (lines 636-652), resolved-greeting preview box using `resolveGreeting`-style 3-tier fallback logic (referenced comment at line 234 pointing to `avatar_persona_service.resolve_greeting_for_locale`).

**`frontend/src/hooks/use-avatar-personas.ts`** (65 lines) — thin TanStack Query wrappers over `frontend/src/api/avatar-personas.ts`'s `avatarPersonasApi`: `useAvatarPersonas()` (list), `useAvatarPersona(id)` (get), `useCreateAvatarPersona()`, `useUpdateAvatarPersona()`, `useDeleteAvatarPersona()`, `useSetDefaultAvatarPersona()`. Standard `invalidateQueries([QUERY_KEY])` on every mutation. **No extension needed here for PEDIT-01..05** — new capability (knowledge configs, instructions preview, live test) will need **new**, separate hook files (mirroring `use-knowledge-base.ts`, `use-hcp-profiles.ts`'s `usePreviewInstructions`), not changes to this file, unless the create/update payload types need new fields (`model_deployment`, `agent_instructions_override` — these DO need adding to `AvatarPersonaCreate`/`AvatarPersonaUpdate` TS types in `frontend/src/api/avatar-personas.ts` and the matching Pydantic schemas).

**Backend `AvatarPersona` model** (`backend/app/models/avatar_persona.py`, 40 lines): `name`, `character`, `style`, `voice_map` (JSON Text), `greeting_map` (JSON Text), `prompt_fragment`, `enabled`, `is_default` + `TimestampMixin` (id/created_at/updated_at). Partial unique index enforcing exactly one enabled+default row (`ix_avatar_personas_unique_default`, SQLite/PostgreSQL dual-dialect `where` clause).

**API router:** `backend/app/api/admin_avatar_personas.py` (91 lines) — `GET ""` (list), `POST ""` (create, 201), `GET "/{persona_id}"`, `PUT "/{persona_id}"`, `DELETE "/{persona_id}"` (204), `POST "/{persona_id}/set-default"`. All backed by `backend/app/services/avatar_persona_service.py` (354 lines): `create_persona`, `list_personas`, `get_persona`, `update_persona`, `delete_persona`, `set_default_persona`, `resolve_active_persona` (used by `personalized_avatar_service.py`), `set_selected_persona`, `resolve_voice_for_locale`, `resolve_greeting_for_locale`, `parse_persona_voice_map`/`parse_persona_greeting_map`.

**Current migration head for `avatar_personas`:** `f39a_persona_greeting_map_unique_default` (down_revision `e38a_create_avatar_persona_table`) — confirmed via revision-graph walk; this is the correct `down_revision` for this phase's new migration(s). **Pitfall:** `alembic heads` currently shows **3 separate heads** in this repo (`f39a_persona_greeting_map_unique_default`, `s22d_system_enums`, `u24a_focus_cu_fields`) — likely orphaned/unmerged branches unrelated to personas. The planner/executor **must run `alembic heads`** (not assume) before writing new migrations, and chain strictly off `f39a_persona_greeting_map_unique_default` for persona-table changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Foundry agent create/update/delete | New Azure SDK wrapper | `agent_sync_service.create_agent`/`update_agent`/`delete_agent` | Already generic (name/instructions/model/metadata/tools params), handles retry/backoff, 500-on-create-vs-pre-created-portal-agent fallback, Entra-ID-then-APIKey auth chain |
| MCP knowledge-base tool wiring for agents | New MCPTool/connection logic | `knowledge_base_service.build_search_tools` + `resolve_kb_remote_tool_connections` | Already duck-typed to any object with `.is_enabled/.connection_target/.index_name/.server_label`; handles the RemoteTool-vs-CognitiveSearch 403 auth-type gotcha |
| WebSocket session-config resolution | New session-config resolver | Extend `_load_connection_config`'s branch pattern | Already handles endpoint/key resolution, avatar-style validation (`validate_avatar_style`), model-catalog fallback-on-unsupported-model |
| Voice/avatar metadata → Foundry agent metadata JSON | New serialization format | `build_voice_live_metadata`'s field-by-field, omit-defaults, 512-char-chunking pattern (as a template to adapt, not literally reuse since it's `HcpProfile`-typed) | Already matches Foundry Portal's own save format exactly (reverse-engineered); reinventing risks Portal-incompatible JSON |
| Instructions auto-generate/override precedence | New override-resolution logic | Mirror `build_agent_instructions`'s override-first pattern (lines 66-69) | Simple, already proven, already what the preview endpoint and the live-session endpoint both rely on for HCP |

**Key insight:** almost nothing here needs re-invention at the *mechanism* level (Azure SDK calls, MCP tool building, metadata JSON shape, override precedence) — the actual work is entirely in *plumbing new, persona-shaped inputs* through those existing mechanisms, plus the two genuinely new pieces (per-locale voice-live metadata resolution, and a persona-shaped instructions template) that have no HCP equivalent to copy because HCP has no per-locale voice concept.

## Common Pitfalls

### Pitfall 1: Assuming HCP's Model Deployment card is a working parity target
**What goes wrong:** Planner copies the HCP UI pattern (`useState` local-only `foundationModel`) verbatim, ships something that *looks* identical to HCP but is equally non-functional, and the persisted `model_deployment` column never gets wired to `create_agent`.
**Why it happens:** The debug-session comment in `persona-editor.tsx` already mirrors HCP's non-functional local state, making it look like an intentional parity choice rather than a known gap.
**How to avoid:** Explicitly wire `model_deployment` to `sync_agent_for_persona`'s `create_agent`/`update_agent` call — this is new functionality, not a copy.
**Warning signs:** If the implementation task only touches frontend `useState`→form-field wiring without touching `agent_sync_service.py`, the feature isn't actually functional.

### Pitfall 2: Polymorphic FK migration risk to HCP data
**What goes wrong:** Migrating `hcp_knowledge_configs.hcp_profile_id` to a generic `owner_id`+`owner_type` requires a backfill (`UPDATE hcp_knowledge_configs SET owner_type='hcp'`) executed inside a SQLite batch-mode `ALTER` — any mistake here corrupts existing production HCP knowledge-base attachments.
**Why it happens:** "Generalize the FK" sounds cleaner in the abstract than "add a parallel table."
**How to avoid:** Use the new-table approach recommended in section 2 — zero migration risk to existing data.
**Warning signs:** A migration file that both `ALTER`s the existing `hcp_knowledge_configs` table AND contains an `UPDATE`/backfill statement.

### Pitfall 3: Conflating `prompt_fragment` with Foundry-agent instructions
**What goes wrong:** Reusing `AvatarPersona.prompt_fragment` as the new "auto-generated instructions override" field silently changes existing text-chat personalization behavior (`personalized_avatar_service.py` line 52), since that field is already consumed elsewhere with different semantics (concatenated ahead of CRM context, sanitized for PII, developer-role message).
**Why it happens:** `prompt_fragment` is the only "instructions-like" field that exists on `AvatarPersona` today, tempting reuse.
**How to avoid:** Add a distinct `agent_instructions_override` column (mirroring HCP's exact naming) — keep `prompt_fragment`'s existing consumer untouched.
**Warning signs:** Any diff that changes `personalized_avatar_service.py`'s handling of `persona.prompt_fragment` as a side effect of PEDIT-04 work.

### Pitfall 4: Workbench Start button bypassing the agent-mode/KB-grounding requirement
**What goes wrong:** Implementing the live test as a "pass everything inline, no DB lookup, works on unsaved changes" model-mode session (mirroring the `vl_instance_id` branch) silently drops knowledge-base grounding from the preview, contradicting CONTEXT.md's requirement that the test reflect the persona's "voice/avatar/instructions/**knowledge**."
**Why it happens:** Model-mode is simpler to wire (no Foundry-agent-sync dependency) and superficially satisfies "开始 button works now."
**How to avoid:** Require Save-then-Start (agent mode, mirroring HCP's own `hcp_profile_id` branch and its mandatory-sync gate) as recommended in section 5.
**Warning signs:** A Start button that's enabled before the persona has ever been saved, or a live-test session that answers questions without citing the persona's attached knowledge base.

### Pitfall 5: Multiple Alembic heads
**What goes wrong:** `alembic upgrade head` fails or targets the wrong branch because 3 heads currently exist in this repo.
**Why it happens:** Unmerged/orphaned migration branches from earlier phases (`s22d_system_enums`, `u24a_focus_cu_fields`) were never consolidated.
**How to avoid:** Run `alembic heads` before authoring new migrations; chain explicitly off `f39a_persona_greeting_map_unique_default`.
**Warning signs:** Alembic CLI errors about multiple heads, or a new migration silently applied to the wrong branch in a fresh dev DB.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Exact Azure Neural voice names for es-ES/es-MX/es-US (e.g. `es-ES-ElviraNeural`, `es-MX-DaliaNeural`, `es-US-PalomaNeural` and their male counterparts) | Section 6 (PEDIT-06) | Voice name typo/deprecation would cause Azure Voice Live session connection failures for Spanish personas at runtime; low severity (easy to fix once caught, isolated to voice dropdown), but should be verified against Azure's current voice list before merging |

**If this table has one entry:** all other claims in this research were verified directly against this repository's source files via Read/Grep in this session (paths and line numbers cited throughout) — the only unverifiable claim, given the WebSearch/WebFetch-forbidden constraint on this task, is the exact spelling of new Azure voice names, which are external-service data, not repo-internal facts.

## Open Questions

1. **Should `modelHint` in `admin.json` (generic "AI coaching" wording) be touched by BRAND-01?**
   - What we know: en-US/es-* use generic lowercase "AI coaching"/"formación con IA" (describes the feature, not the brand); zh-CN uses the exact "AI 教练" brand characters.
   - What's unclear: whether the zh-CN wording was intentionally the brand name or just the most natural Chinese phrasing for "AI-assisted coaching."
   - Recommendation: leave as a judgment call for the executor; low-risk either way since it's a single settings-page hint string, not prominent brand real estate.

2. **Persona knowledge-config frontend: generalize `KnowledgeTab`/`ConnectKbDialog`, or duplicate as persona-scoped components?**
   - What we know: both components are small (129/193 lines), take an `hcpId` prop, and are otherwise generic API-consuming presentational components.
   - What's unclear: whether the codebase's stated preference for small, single-purpose components (no barrel-heavy abstraction layers per CLAUDE.md conventions) favors duplication over a discriminated-union prop.
   - Recommendation: generalize with an `{ ownerType, ownerId }` prop pair — smaller total diff, one place to fix bugs — but duplication is an acceptable, lower-risk alternative if the planner prefers isolation between HCP and persona code paths during this transitional phase.

3. **Exact wording for the new "AI Avatar" brand strings in each locale**
   - What we know: `appName` currently reads "AI Coach" identically across all 5 locales (untranslated); other keys have locale-appropriate translations ("Coach de IA", "AI 教练").
   - What's unclear: whether "AI Avatar" should also stay untranslated across all locales (matching the existing `appName` precedent) or get localized equivalents (zh-CN "AI 化身"/"AI 数字人", es-* "Avatar IA"/"Avatar de IA").
   - Recommendation: flag for user/discuss-phase confirmation before the executor picks exact translated strings — this is a genuine brand-wording decision, not a technical one, and CONTEXT.md's decision only specifies the English anchor term "AI Avatar," not its localized renderings.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Backend framework | pytest 8.3+ / pytest-asyncio 0.24+ (`backend/pyproject.toml` `[tool.pytest.ini_options]`, `testpaths = ["tests"]`) |
| Frontend unit framework | Vitest 3.2+ (`frontend/package.json` `"test": "vitest run"`) |
| E2E framework | Playwright 1.48+ (`frontend/package.json` `"test:e2e": "playwright test --config=e2e/playwright.config.ts"`) |
| Quick run (backend) | `cd backend && pytest tests/test_avatar_persona_service.py tests/test_avatar_personas_api.py tests/test_agent_sync_service.py -v` |
| Quick run (frontend) | `cd frontend && npx vitest run src/pages/admin/persona-editor.test.tsx` |
| Full suite | `cd backend && pytest -v` / `cd frontend && npm run build && npx vitest run && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| PEDIT-01 | Save persona creates/updates Foundry agent | unit | `pytest backend/tests/test_avatar_persona_service.py -k sync -x` | ❌ Wave 0 (extend `test_agent_sync_service.py` with persona cases, or new `test_persona_agent_sync.py`) |
| PEDIT-02 | Knowledge config CRUD scoped to persona | unit | `pytest backend/tests/test_persona_knowledge_config.py -x` | ❌ Wave 0 (new file, mirror `test_knowledge_base.py`) |
| PEDIT-03 | `model_deployment` persists and reaches `create_agent` | unit | `pytest backend/tests/test_avatar_persona_service.py -k model_deployment -x` | ❌ Wave 0 |
| PEDIT-04 | Preview-instructions endpoint (auto-gen + override precedence) | unit | `pytest backend/tests/test_admin_avatar_personas_api.py -k instructions -x` | ❌ Wave 0 |
| PEDIT-05 | Workbench live test connects with persona config | integration (backend) + manual/E2E | `pytest backend/tests/test_hcp_agent_sync_integration.py`-style new file for persona; Playwright for full click-through | ❌ Wave 0 (both backend integration test and `frontend/e2e/admin-avatar-personas.spec.ts` extension) |
| PEDIT-06 | Voice dropdown filters by language incl. Spanish | unit (frontend) | `npx vitest run src/pages/admin/persona-editor.test.tsx -t "voice"` | ✅ existing `persona-editor.test.tsx` — extend with new cases |
| BRAND-01 | No "AI Coach" string renders in any locale | E2E/lint-style check | grep-based CI check (new) or Playwright text-assertion sweep | ❌ Wave 0 (recommend a simple script/test asserting no `AI Coach`/`AI 教练`/`Coach de IA` substring survives in rendered admin/auth/user layouts across locales) |

### Sampling Rate
- **Per task commit:** targeted `pytest <changed test files> -x` / `npx vitest run <changed test file>`
- **Per wave merge:** `pytest -v` (backend) + `npx vitest run` (frontend)
- **Phase gate:** full suite green (`pytest -v`, `npx vitest run`, `npm run build`, `npx tsc -b`, `test:e2e`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_persona_agent_sync.py` (or extend `test_avatar_persona_service.py`) — covers PEDIT-01, PEDIT-03
- [ ] `backend/tests/test_persona_knowledge_config.py` — covers PEDIT-02, mirror `test_knowledge_base.py`'s fixture/mocking approach for Azure SDK calls
- [ ] `backend/tests/test_admin_avatar_personas_api.py` extension — new `preview-instructions` endpoint cases, PEDIT-04
- [ ] New Alembic migration test/smoke-check — verify `alembic upgrade head` succeeds from the current (multi-head!) state; resolve/document the 3-head situation before adding a 4th
- [ ] `frontend/e2e/admin-avatar-personas.spec.ts` extension — end-to-end Save→Start workbench flow, PEDIT-05
- [ ] A rebrand-completeness check (script or test) for BRAND-01 — no existing automated check catches hardcoded (non-i18n) brand strings today

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No change | Existing JWT Bearer (`require_role("admin")`) reused for all new admin endpoints |
| V3 Session Management | Yes (indirect) | New `persona_id` WS session path reuses existing WebSocket session-establishment flow; no new session-token mechanism introduced |
| V4 Access Control | Yes | All new persona endpoints (preview-instructions, knowledge configs, agent sync) MUST use the existing `require_role("admin")` dependency, mirroring `hcp_profiles.py` exactly — do not introduce a laxer check |
| V5 Input Validation | Yes | New Pydantic schemas (`PersonaInstructionsPreviewRequest`, `PersonaKnowledgeConfigCreate`) — reuse Pydantic v2 validation patterns already established for HCP equivalents |
| V6 Cryptography | No change | No new secret/credential handling introduced; Foundry auth reuses existing `_get_project_client`/`DefaultAzureCredential`/API-key chain |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Client-supplied `persona_id` in WS `session.update` used to access another admin's/tenant's persona data | Elevation of Privilege / Info Disclosure | Not currently a concern — personas are a single global admin-managed catalog (no per-user ownership), same trust model as `hcp_profile_id`/`vl_instance_id` today. If multi-tenant personas are ever introduced, this would need an ownership check identical to `get_owned_session` in `personalized_session_service.py`. |
| MCP knowledge-base tool auth (RemoteTool vs CognitiveSearch connection type) | Tampering / Info Disclosure | Already mitigated by `resolve_kb_remote_tool_connections`'s existing fail-loud-on-missing-auth design (section 2) — preserve, do not weaken with a broad try/except when generalizing to personas |
| Azure agent metadata length overflow silently truncating voice config | Tampering (silent data loss) | Reuse the existing `_chunk_metadata_value`/512-char safety-check-and-warn pattern rather than introducing a new, unvalidated serialization path |

## Sources

### Primary (HIGH confidence — direct repo reads in this session)
- `backend/app/services/agent_sync_service.py` (full read, lines 1-979 in segments)
- `backend/app/services/knowledge_base_service.py` (targeted reads, lines 232-282, 522-590)
- `backend/app/services/voice_live_websocket.py` (targeted reads, lines 103-530)
- `backend/app/models/avatar_persona.py`, `backend/app/models/hcp_profile.py`, `backend/app/models/hcp_knowledge_config.py` (full reads)
- `backend/app/schemas/avatar_persona.py` (full read)
- `backend/app/api/hcp_profiles.py`, `backend/app/api/admin_avatar_personas.py`, `backend/app/api/knowledge_base.py` (targeted reads)
- `frontend/src/pages/admin/persona-editor.tsx` (full structural read across segments)
- `frontend/src/components/admin/agent-config-left-panel.tsx`, `agent-foundation-model-select.tsx`, `knowledge-tab.tsx`, `playground-preview-panel.tsx` (targeted reads)
- `frontend/src/components/voice/voice-test-playground.tsx`, `frontend/src/hooks/use-voice-session-lifecycle.ts`, `use-voice-live.ts` (targeted reads)
- `frontend/src/lib/voice-constants.ts` (full read)
- `frontend/src/hooks/use-avatar-personas.ts` (full read)
- All 5 locale directories under `frontend/public/locales/*/` (grep-based inventory, `auth.json`/`common.json`/`training.json`/`coach.json`/`admin.json`)
- `backend/alembic/versions/` (revision-graph walk via script, plus `e38a_create_avatar_persona_table.py`/`f39a_persona_greeting_map_unique_default.py`/`p19a_add_hcp_knowledge_configs.py` pattern reads)

### Secondary (MEDIUM confidence)
- None — this was a codebase-internal task; no external sources consulted.

### Tertiary (LOW confidence — flagged for validation)
- A1 in Assumptions Log: exact Azure Spanish Neural voice names, from training knowledge only.

## Metadata

**Confidence breakdown:**
- Backend architecture/APIs (sections 1-5, 8): HIGH — every claim traced to specific file/line in this repo
- Frontend structure (sections 5, 6, 8): HIGH — same
- BRAND-01 inventory (section 7): HIGH for what was found; MEDIUM on completeness (grep-based, could theoretically miss dynamically-constructed strings, though none were found)
- Voice catalog Spanish additions (section 6): LOW on exact voice names (A1), HIGH on the structural fix (locale field + filter)

**Research date:** 2026-08-04
**Valid until:** 30 days (stable, internal-codebase research; re-verify if Phase 39+ touches `agent_sync_service.py`, `voice_live_websocket.py`, or the locale JSON files before this phase is implemented)
