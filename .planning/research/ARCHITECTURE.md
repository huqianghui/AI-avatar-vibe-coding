# Architecture Research — v2.0 Avatar MVP Integration

**Domain:** Adding anonymous + personalized avatar Q&A to an existing MR-coaching platform (FastAPI + React, Azure PaaS)
**Researched:** 2026-07-31
**Confidence:** HIGH (codebase-integration analysis — direct file/line citations below; no external ecosystem claims made in this document)

> Supersedes the 2026-03-24 v1.0 "greenfield" architecture doc. That version described the coaching platform when it was still a stub. This version describes **how the four v2.0 requirements graft onto the codebase that actually exists today** (Phases 1–31 already built).

---

## Standard Architecture

### System Overview — what's being added

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BROWSER (React SPA)                                                       │
│                                                                            │
│  NEW: /avatar (public)          EXISTING: /user/* (coach, hidden by flag) │
│  ┌───────────────────────┐      ┌────────────────────────────────────┐   │
│  │ AvatarPage             │      │ UnifiedSession / ConferenceSession │   │
│  │ - digital human panel  │      │ (unchanged, nav entry hidden)      │   │
│  │ - Sources panel (sep.) │      └────────────────────────────────────┘   │
│  └──────────┬─────────────┘                                              │
│             │ fetch() SSE (extends use-sse.ts pattern)                    │
└─────────────┼──────────────────────────────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ FASTAPI BACKEND                                                           │
│                                                                            │
│  NEW public_avatar.py router (no get_current_user, slowapi rate-limited) │
│    ├─ POST /public/avatar/message  ──┐                                   │
│    └─ POST /public/avatar/token      │                                   │
│                                        ▼                                  │
│  NEW avatar_service.py (orchestrates, per-request)                       │
│    ├─ calls existing agent_chat_service.stream_agent_response()  (reuse) │
│    ├─ calls NEW avatar_search_service.retrieve() for citations   (new)   │
│    └─ writes NEW AvatarInteractionLog row                        (new)   │
│                                        │                                  │
│  EXISTING voice_live_service.get_voice_live_token()  ── reused, wrapped  │
│  EXISTING agent_sync_service (build_agent_instructions, MCPTool sync)    │
│  EXISTING knowledge_base_service (build_search_tools, SEARCH_TOKEN_SCOPE)│
│  EXISTING azure_auth.get_bearer_token(scope)         ── reused as-is    │
│                                                                            │
│  AUTHENTICATED variant (personalized):                                   │
│    /avatar/message (existing-style router, get_current_user)            │
│    NEW personalization_service.py                                        │
│    ├─ reads NEW CrmProfileMapping (Excel POC ingestion, admin-uploaded)  │
│    └─ prepends per-user context message into agent_chat kwargs["input"] │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Status | Responsibility | Codebase evidence |
|-----------|--------|-----------------|--------------------|
| `app/api/public_avatar.py` | **NEW** | Unauthenticated router: message + token endpoints, slowapi rate limits | Pattern mirrors `backend/app/api/voice_live.py:46` (`router = APIRouter(prefix=..., tags=...)`) but *without* `Depends(get_current_user)` |
| `app/api/avatar.py` | **NEW** | Authenticated router for personalized turns; reuses `get_current_user` | Pattern mirrors `backend/app/api/sessions.py:96-160` (`send_message` SSE handler) |
| `AnonymousAvatarSession` model | **NEW** | Lightweight session/continuity record for anonymous visitors (id, language, `foundry_response_id`, `created_at`, `last_seen_at`) — **not** a `CoachingSession` | `CoachingSession.user_id` is `nullable=False` (`backend/app/models/session.py:20-21`) and is deeply wired into scenario/skill/scoring FKs — reusing it for anonymous traffic would corrupt an unrelated bounded context |
| `AvatarInteractionLog` model | **NEW** | Append-only audit row per turn: session_id (nullable FK), user_id (nullable), question, answer, citations (JSON), agent_name/version, mode (`anonymous`/`personalized`) | Satisfies CLAUDE.md domain rule 7: "All avatar interactions must be auditable (traceable knowledge source per response)" — no existing model covers this |
| `avatar_service.py` | **NEW** | Per-turn orchestrator: calls agent chat + citation retrieve + audit log write, in that order | Thin coordination layer, analogous role to how `sessions.py:123-160` orchestrates `stream_agent_response` + `save_message` |
| `avatar_search_service.py` | **NEW** | Wraps Azure AI Search `retrieve` REST action (httpx) for citation envelope — **separate from** the MCP tool the agent itself uses for grounding | Confirmed by sibling research: Foundry IQ MCP tool path returns no structured citations; `retrieve` REST does. Reuses `SEARCH_API_VERSION`/`SEARCH_TOKEN_SCOPE` constants already defined at `backend/app/services/knowledge_base_service.py:33-34` and `azure_auth.get_bearer_token(scope)` at `backend/app/services/azure_auth.py:88` |
| `PublicKnowledgeConfig` model | **NEW** | KB connection (connection_target, index_name) for the public-facing agent, decoupled from `hcp_profile_id` | `HcpKnowledgeConfig.hcp_profile_id` is `nullable=False` FK to `hcp_profiles` (`backend/app/models/hcp_knowledge_config.py:14-16`) — no anonymous/public-facing knowledge config concept exists; a parallel model avoids an FK-nullability hack on coach-domain data |
| `agent_chat_service.stream_agent_response()` | **REUSE unchanged** | Streams Foundry Responses API events (`text`/`completed`) for any `agent_name`/`agent_version` pair | `backend/app/services/agent_chat_service.py:130-160` — takes `db, agent_name, agent_version, message, previous_response_id`; contains **no auth logic**, so it's safe to call from an unauthenticated router as long as the agent itself is a dedicated, scoped "public" agent (never the coach HCP agents) |
| `agent_chat_service._build_openai_request()` | **EXTEND (minimal)** | Currently builds `kwargs["input"] = [{"role": "user", "content": message}]` (`backend/app/services/agent_chat_service.py:47-76`) | Add an optional `extra_input: list[dict] | None` param that gets prepended to `input` — this is the seam for per-user personalization context (see below) |
| `voice_live_service.get_voice_live_token()` | **REUSE, wrap** | Issues Azure Voice Live credentials, optionally scoped by `hcp_profile_id` | `backend/app/api/voice_live.py:69-89` — router-level `Depends(get_current_user)` is what currently gates it; the service function itself is reusable. New public endpoint calls the same service with no `hcp_profile_id` (or a "public avatar" pseudo-profile) and **must** add slowapi rate limiting since it now hands out Azure credentials to unauthenticated callers |
| `knowledge_base_service.build_search_tools()` / `resolve_kb_remote_tool_connections()` | **REUSE unchanged** | Builds `MCPTool` list from KB configs, find-or-creates RemoteTool ARM connection | `backend/app/services/knowledge_base_service.py:522-576` and `:329+` — signature takes `list[HcpKnowledgeConfig]`; either (a) add a thin adapter that maps `PublicKnowledgeConfig` rows into the same duck-typed shape, or (b) generalize the function's type hint to a `Protocol` with `is_enabled/connection_target/index_name/server_label`. Prefer (a) for minimal-diff. |
| `agent_sync_service` create/update-agent helpers | **REUSE unchanged** | Create/update a hosted Foundry Prompt Agent with instructions + MCPTool | `backend/app/services/agent_sync_service.py:466-504`, `:618-648` — used once to provision the single "public avatar" agent (not per-visitor, not per-turn) |
| `CrmProfileMapping` (+ `CrmMappingImport` batch) models | **NEW** | Excel POC ingestion: one `CrmMappingImport` (batch/version) → many `CrmMappingRow` (per user_id, product/preference fields) | Mirrors the existing `TrainingMaterial` (batch) / `MaterialVersion` (versioned content) split (`backend/app/models/material.py:9-37`) rather than inventing a new versioning shape |
| `material_service.upload_material()` | **PATTERN REUSE, not code reuse** | Router → `UploadFile` → storage → DB row, with versioning | `backend/app/services/material_service.py:13-90` — the *shape* of upload+parse+persist is reused for the new Excel ingestion endpoint; the content (rows of user_id→CRM fields, not documents-for-RAG) is different enough to warrant a new service, not extending `material_service.py` |
| `personalization_service.py` | **NEW** | Builds a per-user context message (CRM fields + tagged preferences) using the same `str.format_map(defaultdict(...))` templating idiom already used for agent instructions | `agent_sync_service.build_agent_instructions()` (`backend/app/services/agent_sync_service.py:55-99`) is the template-safety pattern to copy — but it runs at **agent-sync time** (compile-time, one shared hosted agent). Personalization must run at **chat time** (per turn, per user) since it can't require a Foundry agent re-sync on every login |
| `use-sse.ts` citation event | **EXTEND** | Add `case "citations":` branch parallel to existing `case "hint":`/`case "key_messages":` | `frontend/src/hooks/use-sse.ts:76-96` — this hook already demonstrates the exact JSON-event-over-SSE convention needed; no new transport mechanism required |

---

## Recommended Project Structure (delta only)

```
backend/app/
├── api/
│   ├── public_avatar.py         # NEW — anonymous router, slowapi-limited
│   └── avatar.py                # NEW — authenticated/personalized router
├── models/
│   ├── avatar_session.py        # NEW — AnonymousAvatarSession
│   ├── avatar_interaction_log.py# NEW — AvatarInteractionLog (audit trail, both modes)
│   ├── public_knowledge_config.py # NEW — PublicKnowledgeConfig
│   └── crm_profile_mapping.py   # NEW — CrmMappingImport + CrmMappingRow
├── schemas/
│   ├── avatar.py                # NEW — request/response + citation envelope shape
│   └── crm_mapping.py           # NEW
├── services/
│   ├── avatar_service.py        # NEW — per-turn orchestrator (anonymous + personalized)
│   ├── avatar_search_service.py # NEW — AI Search `retrieve` REST wrapper
│   ├── personalization_service.py # NEW — per-user context message builder
│   ├── crm_mapping_service.py   # NEW — Excel ingestion (openpyxl/pandas)
│   ├── agent_chat_service.py    # MODIFIED — optional extra_input param
│   ├── knowledge_base_service.py# MODIFIED (thin) — adapter for PublicKnowledgeConfig
│   └── agent_sync_service.py    # UNCHANGED — reused for one-time public agent provisioning
└── alembic/versions/
    └── xxxx_add_avatar_v2_tables.py  # NEW migration

frontend/src/
├── pages/
│   └── avatar/
│       ├── avatar-page.tsx      # NEW — single shell, branches on auth store for mode
│       ├── sources-panel.tsx    # NEW — separate DOM element for citations (domain rule 6)
│       └── avatar-page.test.tsx # NEW
├── hooks/
│   ├── use-avatar-sse.ts        # NEW (or extend use-sse.ts with citations case)
│   └── use-avatar-token.ts      # NEW — wraps public token endpoint
├── i18n/... locales/es/*.json   # NEW namespace files (separate milestone concern, noted for completeness)
└── router/index.tsx             # MODIFIED — add public /avatar route; change `/` redirect target
```

### Structure Rationale

- **New models instead of touching `CoachingSession`/`HcpKnowledgeConfig`:** both existing tables carry `NOT NULL` foreign keys into the coach/HCP bounded context (`scenario_id`, `hcp_profile_id`). Making them nullable to support anonymous/public traffic would leak avatar-MVP concerns into a domain slated for eventual deletion (per PROJECT.md: coach code is hidden-not-deleted this milestone). A parallel, small set of tables is lower blast radius and trivially removable later.
- **`avatar_service.py` as orchestrator, not fatter routers:** matches the existing layered convention (Router → Schema → Service → Model) documented in CLAUDE.md and visible in `sessions.py` delegating to `session_service`/`agent_chat_service`/`suggestion_service`.
- **`agent_chat_service.py` gets a minimal additive change, not a fork:** duplicating the streaming/queue/thread-bridging logic in `stream_agent_response` (`agent_chat_service.py:130-201`, uses `asyncio.Queue` + `loop.call_soon_threadsafe` to bridge the sync SDK stream) would be a maintenance liability. One optional parameter keeps coach and avatar flows on the same tested code path.

---

## Architectural Patterns

### Pattern 1: Dual-query citation shadow pattern

**What:** The agent's own MCPTool call against Foundry IQ (used for answer grounding) does not surface structured citations to the caller. To show sources in the UI, the backend issues a **second, independent** call to the AI Search `retrieve` REST action with the same user query, purely to obtain the reference/citation envelope.

**When to use:** Any turn in the anonymous (and later personalized, if it also cites public content) avatar flow that must render a "Sources" panel.

**Trade-offs:** Two search calls per turn (cost, latency) instead of one. Accepted because the MCP tool path is confirmed to omit citations entirely — there is no single-call alternative available today. Run the `retrieve()` call concurrently with `stream_agent_response()` (e.g. `asyncio.gather`) rather than sequentially, so citation latency doesn't add to perceived answer latency.

**Example:**
```python
# avatar_service.py
async def handle_turn(db, session, message: str):
    text_task = asyncio.create_task(collect_agent_text(db, PUBLIC_AGENT_NAME, PUBLIC_AGENT_VERSION, message, session.foundry_response_id))
    citations_task = asyncio.create_task(avatar_search_service.retrieve(db, kb_config, message))
    # stream text_task events to the client as they arrive; await citations_task once, emit as one SSE "citations" event
```

### Pattern 2: Per-turn context injection instead of per-user agent sync

**What:** `build_agent_instructions()` bakes profile data into a *shared, compiled* hosted agent's instructions at sync time (`agent_sync_service.py:55-99`). That's correct for the ~dozens of HCP personas, re-synced only when an admin edits a profile. It is wrong for personalization keyed by `user_id`, where re-syncing (or worse, creating) a Foundry agent per login is both slow and creates unbounded agent sprawl in the Foundry project.

**When to use:** Any personalization that varies per end-user rather than per admin-configured persona.

**Trade-offs:** Requires extending `agent_chat_service._build_openai_request()`'s `kwargs["input"]` construction (currently a single `{"role": "user", "content": message}` entry, `agent_chat_service.py:63-65`) to accept a prepended context message — a small, additive change with no effect on the existing coach flow when the new parameter is omitted.

**Example:**
```python
# personalization_service.py
def build_user_context_message(crm_row: CrmMappingRow, preferences: list[str]) -> str:
    data = {"product_focus": crm_row.product, "region": crm_row.region, "preferences": ", ".join(preferences)}
    return DEFAULT_USER_CONTEXT_TEMPLATE.format_map(defaultdict(str, data))

# agent_chat_service.py (extended)
async def stream_agent_response(db, agent_name, agent_version, message, previous_response_id=None, extra_input=None):
    ...
    kwargs["input"] = (extra_input or []) + [{"role": "user", "content": message}]
```

### Pattern 3: SSE event-schema extension (not a new transport)

**What:** `use-sse.ts` already parses named SSE events (`text`, `hint`, `key_messages`, `done`, `error`) via a byte-stream reader + manual `event:`/`data:` line parsing (`frontend/src/hooks/use-sse.ts:70-97`). Adding citations means adding one more `case "citations":` branch and one more backend `yield {"event": "citations", "data": json.dumps([...])}` — no new WS channel, no separate REST round-trip per turn.

**When to use:** Anonymous and personalized avatar turns both need this; use the same event name so the frontend `Sources` panel component is mode-agnostic.

**Trade-offs:** None significant — this is the lowest-diff option and keeps voice/text output and citation data on the same stream while still rendering to **separate DOM elements** (satisfying the "never merge into one bubble" domain rule at the component level, not the transport level).

---

## Data Flow

### Anonymous flow (new)

```
Visitor (no login)
    ↓
AvatarPage → useAvatarSSE.sendMessage()
    ↓ POST /api/v1/public/avatar/message  (public_avatar.py, slowapi-limited, no JWT)
    ↓
avatar_service.handle_turn()
    ├─→ agent_chat_service.stream_agent_response(PUBLIC_AGENT, message, session.foundry_response_id)
    │       → SSE "text" events streamed as they arrive (unchanged mechanism)
    ├─→ avatar_search_service.retrieve(public_kb_config, message)   [concurrent]
    │       → SSE "citations" event, once, after retrieval completes
    └─→ AvatarInteractionLog row written (question, answer, citations, mode="anonymous")
    ↓
AnonymousAvatarSession.foundry_response_id updated for next turn (multi-turn continuity
without requiring login; no PII stored)
```

### Personalized flow (new, authenticated)

```
Logged-in user
    ↓
AvatarPage (auth branch) → useAvatarSSE.sendMessage()
    ↓ POST /api/v1/avatar/message  (avatar.py, Depends(get_current_user))
    ↓
avatar_service.handle_turn(user_id=...)
    ├─→ personalization_service.build_user_context_message(crm_row, preferences)
    ├─→ agent_chat_service.stream_agent_response(PUBLIC_AGENT, message, prev_response_id, extra_input=[context_msg])
    ├─→ avatar_search_service.retrieve(...)   [same citation mechanism as anonymous]
    └─→ AvatarInteractionLog row (user_id set, mode="personalized")
```

### Excel CRM ingestion flow (new, admin-only)

```
Admin uploads .xlsx  →  crm_mapping_service.import_mapping()
    → parse rows (pandas/openpyxl) → CrmMappingImport (batch) + CrmMappingRow[] (per user_id)
    → validation: user_id must match an existing User.id (or external key), reject/report otherwise
    → subsequent personalized turns look up CrmMappingRow by request.user.id
```

---

## Scaling Considerations

| Concern | MVP (POC/demo) | Near-term (pilot rollout) | Beyond MVP |
|---------|----------------|---------------------------|------------|
| Anonymous rate limiting | slowapi in-process (per-IP) on `public_avatar.py` | Same + Azure Front Door/WAF rate limiting | Dedicated API gateway throttling |
| Citation double-query cost | Accept 2x AI Search calls per turn | Cache `retrieve()` results per (kb, normalized-query) for a short TTL | Investigate whether Foundry IQ adds citation support to the MCP path directly (re-check official docs periodically — do not assume permanently absent) |
| CRM mapping freshness | One-off admin Excel upload, no versioning UI needed beyond `CrmMappingImport` batch id | Add "replace vs merge" import modes | Real CRM API integration (explicitly out of scope this milestone) |
| Anonymous session data volume | `AnonymousAvatarSession` rows can be cleaned up by a simple TTL job | Add scheduled cleanup task | — |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Making `CoachingSession.user_id` nullable to "support anonymous"

**What people do:** See the NOT NULL constraint blocking anonymous sessions and reach for an Alembic migration to relax it.
**Why it's wrong:** `CoachingSession` carries `scenario_id` (also NOT NULL) plus scoring/skill FKs — anonymous avatar turns have no scenario, no rubric, no HCP profile. Shoehorning them in means either inventing dummy scenario rows or littering the coach domain's queries/reports with anonymous noise that must be filtered everywhere.
**Do this instead:** A dedicated `AnonymousAvatarSession` model, entirely outside the coach bounded context.

### Anti-Pattern 2: Treating the MCP knowledge-base tool as the citation source

**What people do:** Assume that because the agent's MCPTool retrieves from Foundry IQ to ground its answer, the same call's response can be intercepted for citations.
**Why it's wrong:** Confirmed by sibling research — the MCP tool path returns no structured citation envelope to the calling code; only the direct AI Search `retrieve` REST action does.
**Do this instead:** Issue an explicit, separate `retrieve()` call (Pattern 1 above) purely for citations, run concurrently with the agent stream.

### Anti-Pattern 3: Re-syncing/creating a Foundry hosted agent per logged-in user for personalization

**What people do:** Copy the HCP-profile pattern literally — call `create_agent`/`update_agent` (agent_sync_service.py:466-504) per user so each user's "agent" has baked-in instructions.
**Why it's wrong:** Unbounded agent sprawl in the Foundry project, slow (network round-trip to Foundry control plane) on every login, and the existing sync helpers are designed around admin-edited HCP personas (dozens), not per-request end users (potentially thousands).
**Do this instead:** One shared "public avatar" hosted agent; per-user personalization injected as a prepended message in `kwargs["input"]` at chat time (Pattern 2).

### Anti-Pattern 4: Removing coach routes from `router/index.tsx` to "hide" the feature

**What people do:** Delete the `/user/training/*` and `/admin/*` coach route entries to satisfy "hide old coach feature entrances."
**Why it's wrong:** CLAUDE.md/PROJECT.md explicitly require **code retained, only entrances hidden** this milestone; deleting routes breaks any existing E2E spec that navigates directly to those URLs (deep links), and is a much larger diff to later reverse when a future milestone actually removes the feature.
**Do this instead:** Feature-flag the **nav links** only (`feature_coach_nav_visible`, mirroring existing `feature_*` settings in `backend/app/config.py:43-47`), leave every route in `router/index.tsx` intact. Only the `/` redirect target and nav rendering change.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Azure AI Search `retrieve` REST action | New httpx call in `avatar_search_service.py`, auth via `azure_auth.get_bearer_token(SEARCH_TOKEN_SCOPE)` (existing constant, `knowledge_base_service.py:34`) | This is a **new integration**, distinct from the existing MCPTool integration used for answer grounding |
| Azure AI Foundry Agents (Responses API) | Reused as-is via `agent_chat_service.stream_agent_response()` | No new integration; one new dedicated hosted agent provisioned via existing `agent_sync_service` helpers |
| Azure Voice Live (avatar rendering) | Reused via `voice_live_service.get_voice_live_token()`, called from a new unauthenticated endpoint | Must add slowapi rate limiting — this endpoint did not previously need to defend against unauthenticated credential-issuance abuse |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `public_avatar.py` (anonymous) ↔ `avatar.py` (authenticated) | Both call the same `avatar_service.handle_turn()`, differing only in whether `user_id`/personalization context is passed | Keeps the citation/audit-log/SSE-event logic in exactly one place |
| `avatar_service.py` ↔ `agent_chat_service.py` | Direct function call, no new abstraction layer | `agent_chat_service` remains provider-agnostic re: Foundry Responses API; avatar-specific concerns (citations, audit) stay in `avatar_service` |
| Frontend `AvatarPage` ↔ `UserLayout`/`AdminLayout` nav | Feature-flag controlled visibility only, no shared route tree | Coach layouts unaffected; avatar page is a new top-level route outside both `ProtectedRoute` and `GuestRoute` wrappers (must support both auth states in one component or branch at the route level) |

---

## Suggested Build Order

Dependencies flow top-to-bottom; items on the same tier can be parallelized.

**Tier 1 — Foundation (no feature depends on skipping this)**
1. Migration: `AnonymousAvatarSession`, `AvatarInteractionLog`, `PublicKnowledgeConfig` models + Alembic revision.
2. `public_avatar.py` router skeleton (empty handlers) + slowapi wired into `main.py`, registered alongside existing routers (`backend/app/main.py:124-146` pattern).

**Tier 2 — Anonymous Q&A core** (depends on Tier 1)
3. Provision the dedicated "public avatar" hosted Foundry agent (one-time, via existing `agent_sync_service` create-agent helper) + `PublicKnowledgeConfig` row pointing at the official-website Foundry IQ index; adapt `knowledge_base_service.build_search_tools()` input shape.
4. `avatar_search_service.py` (`retrieve` REST wrapper) — buildable in parallel with #3 once the index name is known.
5. `avatar_service.py` orchestrator wiring #3 (agent chat) + #4 (citations) + audit log write; wire into `public_avatar.py` message endpoint with SSE `text`/`citations`/`done`/`error` events (extends the `sessions.py:123-160` pattern).
6. Public token endpoint wrapping `voice_live_service.get_voice_live_token()`, rate-limited.

**Tier 3 — Anonymous frontend** (depends on Tier 2)
7. `frontend/src/pages/avatar/avatar-page.tsx` + `sources-panel.tsx` + `use-avatar-sse.ts` (extends `use-sse.ts` pattern with a `citations` case); router change for public `/avatar` route and new `/` redirect target.

**Tier 4 — Personalization backend** (depends on Tier 1; independent of Tiers 2–3, can start in parallel)
8. `CrmMappingImport`/`CrmMappingRow` models + migration; `crm_mapping_service.py` Excel ingestion + admin upload endpoint (pattern-borrowed from `material_service.py`).
9. `personalization_service.py` context-message builder; extend `agent_chat_service._build_openai_request()` with optional `extra_input`.
10. `avatar.py` authenticated router calling the same `avatar_service.handle_turn()` with `user_id` + personalization context.

**Tier 5 — Personalized frontend + polish** (depends on Tiers 3 and 4)
11. Auth-aware branch in `avatar-page.tsx` (personalized variant reusing the same shell/sources-panel).
12. `feature_coach_nav_visible` flag; hide coach nav links in `UserLayout`/`AdminLayout`; verify no route deletions.
13. Full E2E pass: anonymous flow, personalized flow, citation rendering separation, coach-nav-hidden assertion.

*(Spanish i18n is orthogonal to this architecture — it can land on any tier without blocking, per sibling i18n research; not sequenced here.)*

---

## Sources

All findings in this document are derived directly from the current codebase (no external web sources consulted, per research scope):

- `.planning/PROJECT.md` — milestone scope, requirements, out-of-scope boundaries
- `backend/app/models/session.py:11-24` — `CoachingSession.user_id`/`scenario_id` NOT NULL constraints
- `backend/app/models/hcp_knowledge_config.py:9-24` — `HcpKnowledgeConfig.hcp_profile_id` NOT NULL FK
- `backend/app/models/material.py:9-52` — `TrainingMaterial`/`MaterialVersion` batch+version pattern reused for CRM mapping ingestion
- `backend/app/services/agent_chat_service.py:1-201` — `AgentResponseEvent`, `_build_openai_request`, `stream_agent_response`, `chat_with_agent`
- `backend/app/services/knowledge_base_service.py:1-70, 280-360, 500-633` — MCPTool/RemoteTool wiring, `SEARCH_API_VERSION`/`SEARCH_TOKEN_SCOPE`
- `backend/app/services/agent_sync_service.py:55-99` — `build_agent_instructions()` templating idiom
- `backend/app/services/azure_auth.py` (grep: `get_bearer_token` at line 88) — reusable bearer-token helper for AI Search scope
- `backend/app/services/material_service.py:13-90` — upload pattern reused as structural template
- `backend/app/api/voice_live.py:1-89` — token broker router pattern, existing `Depends(get_current_user)` gating
- `backend/app/api/sessions.py:1-160` — SSE orchestration pattern (`event_generator`, named SSE events)
- `backend/app/dependencies.py` — `get_current_user` (no optional-auth variant exists today)
- `backend/app/main.py:124-146` — router registration pattern
- `backend/app/config.py:29-47` — `cors_origins`, `feature_*` settings pattern
- `frontend/src/router/index.tsx:61-142` — route tree, `/` → `/login` redirect, `GuestRoute`/`ProtectedRoute`/`AdminRoute` wrappers
- `frontend/src/i18n/index.ts:1-32` — hardcoded `supportedLngs: ["en-US", "zh-CN"]`
- `frontend/src/hooks/use-sse.ts:1-115` — SSE event parsing convention (`text`/`hint`/`key_messages`/`done`/`error`), reused for new `citations` event

---
*Architecture research for: v2.0 Avatar MVP integration onto existing AI Avatar Platform codebase*
*Researched: 2026-07-31*
