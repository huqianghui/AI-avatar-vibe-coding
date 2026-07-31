# Stack Research

**Domain:** Avatar MVP additions (anonymous Foundry IQ grounded Q&A + citations, CRM-Excel personalization, es-ES i18n, avatar-first UI) on top of the existing AI Avatar Platform
**Researched:** 2026-07-31
**Confidence:** MEDIUM-HIGH (citation architecture verified against Microsoft Learn docs updated 2026-07-21/24; index-schema availability of document URLs is an open question — see Gaps)

> **Note:** This replaces the earlier (2026-03-24) version of this file, which researched the *original* v1.0 stack (Azure OpenAI Realtime, Speech Avatar, Content Understanding, etc.) before implementation. Those decisions are now **existing, validated capabilities** — see `.planning/PROJECT.md` — and are intentionally out of scope here per the milestone brief. This file is a **delta stack** for the four v2.0 Avatar MVP requirements only.

The headline finding: **almost none of the four new capabilities need a new heavy dependency.** The real work is new *usage* of libraries already in `pyproject.toml`/`package.json`, plus one small, well-justified new dependency (`slowapi`) and one architectural pivot for how citations are obtained.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Azure AI Search **Knowledge Retrieval `retrieve` action** (REST, `api-version=2026-05-01-preview`) | n/a (REST endpoint, not a package) | Anonymous mode: get a grounded answer **and** a structured `references[]` array (docKey, sourceData, activitySource) in one call | This is the only Foundry IQ code path that returns machine-parseable citations. The `knowledge_base_retrieve` **MCP tool** used by the existing Agent+KB integration does **not** return a `references`/`activity` envelope — confirmed in MS Learn "Query Knowledge Base via API or MCP" (updated 2026-07-24): *"Unlike the retrieve action, the current MCP response doesn't return separate `activity` or `references` arrays, and it doesn't populate `resource` entries."* Anything built on the Agent+MCP path for the anonymous flow would have to scrape citations out of free-form LLM prose — unreliable and un-auditable, violating the "traceable knowledge source per response" requirement and the "source separation" UI requirement in CLAUDE.md. |
| `httpx` (existing dep, `>=0.27.0`) | current | HTTP client to call the `retrieve` REST endpoint directly | Already the exact pattern used in `backend/app/services/knowledge_base_service.py::_get_knowledgebases` / `_search_auth_headers` for listing KBs. Reuse the same auth helper (API key first, Entra ID bearer fallback) instead of introducing a second HTTP client or a new preview SDK. |
| `openpyxl` (existing dep, `>=3.1.0`, currently pinned `3.1.2`, latest `3.1.5`) | keep `>=3.1.0` (optionally bump to `>=3.1.2`) | **Read** the CRM Excel mapping table (user_id → profile/preference columns) into a DB table | Already a backend dependency, but today it is only used for **writing** exports (`export_service.py`). No new library needed — just a new read-path service. `openpyxl` handles `.xlsx` row/column iteration fine for a lookup table; no streaming/large-file concerns at POC scale (one mapping sheet, not a training-material corpus). |
| `fastapi.security.OAuth2PasswordBearer(auto_error=False)` (built into existing FastAPI dep) | current | New `get_current_user_optional` dependency so one endpoint serves both anonymous and logged-in avatar sessions | No new package. Mirrors `get_current_user` in `backend/app/dependencies.py` but returns `None` instead of raising 401 when no/invalid token is present; the route then branches: no user → anonymous Foundry IQ retrieve path; user present → personalized CRM+preference path. |
| `slowapi` (new dep, `0.1.10`, released 2026-06-13) | `>=0.1.10` | Rate limiting for the newly-public, unauthenticated Q&A endpoint | This is the one genuinely new capability gap: every other endpoint in this codebase sits behind `get_current_user`. An anonymous endpoint with no auth gate is a direct cost/abuse vector (each call burns Azure AI Search + Azure OpenAI tokens). `slowapi` is a thin Starlette/FastAPI middleware wrapping the `limits` library — small, actively maintained (last release 2026-06-13), integrates as a single dependency + decorator, no infra changes required for the POC. |
| `i18next` / `react-i18next` (existing deps, `25.10.5` / `16.6.2`) | no version change needed | Add `es-ES` as a third supported language | Both libraries already handle arbitrary BCP-47 locale codes (including Spanish plural rules) out of the box — this is a **config + content** change, not a library upgrade. Add `"es-ES"` to `supportedLngs` in `frontend/src/i18n/index.ts` and create `frontend/public/locales/es-ES/*.json` mirroring the existing 14 namespaces under `en-US`/`zh-CN`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `limits` (transitive dep of `slowapi`) | pulled automatically | In-memory (or Redis-backed) rate-limit storage | Default in-memory storage is fine for a single-replica POC container. If Azure Container Apps scales the backend to >1 replica, switch `limits`' storage backend to Redis (Azure Cache for Redis) so rate limits are shared across replicas — otherwise each replica gets its own independent quota. |
| `azure-ai-projects` (existing dep, `>=2.3.0`) | unchanged | Personalized-mode chat still goes through the existing Foundry Agent (`agent_chat_service.py` / `agent_sync_service.py`) so CRM-derived preferences can be injected via the existing prompt-registry/system-prompt mechanism | Only for the **logged-in** path. Anonymous mode should bypass the Agent layer entirely (see Core Technologies) to get reliable citations and avoid per-session agent-sync overhead for users who were never going to be tied to an HCP profile anyway. |
| `crypto.randomUUID()` (native browser API, no package) | n/a | Generate a client-side anonymous session id, stored in `localStorage`, sent as a header to correlate multi-turn anonymous conversation without a JWT | Supported in all evergreen desktop/mobile browsers and the Teams Tab WebView2 host required by this project's responsiveness constraint — no `uuid` npm package needed. |
| Existing lightweight store pattern (`frontend/src/stores/auth-store.ts`) | n/a | Add a sibling `guest-session-store.ts` for anonymous session id + language, using the same custom store pattern already in the repo | Keeps state management consistent — this repo deliberately has **no Redux/Zustand**; don't introduce one just for a session id. |
| `react-markdown` + `rehype-raw` (existing deps) | unchanged | Render the digital human's answer text | Already used for AI response rendering; reuse as-is for the avatar's text bubble. Citations must render as a **separate** component (plain list of `{title, url}` links), never interpolated into the markdown body — this is a UI composition rule, not a new dependency. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `pytest` + `pytest-asyncio` (existing) | Unit tests for the new retrieve-call service, XLSX-mapping importer, optional-auth dependency, rate limiter | No config changes; keep the existing `--cov-fail-under` gate honest — these are net-new modules so they should each carry their own tests to avoid dragging the global coverage number down. |
| `Playwright` (existing) | E2E: anonymous chat flow with visible citation links; logged-in personalized flow; language switch including `es-ES` | Add scenarios under `frontend/e2e/`; reuse `i18n-switching.spec.ts` as the template for the new locale, and reuse the existing avatar/voice E2E scaffolding (`avatar-view.tsx`/`voice-session.tsx`) for the "clean UI" layout regression check (only avatar + source links visible, coach nav hidden). |

## Installation

```bash
# Backend — only one net-new package
cd backend
pip install "slowapi>=0.1.10"
# openpyxl, httpx, azure-ai-projects, azure-identity are already installed dependencies —
# no version bump strictly required (bump openpyxl to >=3.1.2 only if pinned lower).

# Frontend — no new packages at all
# (i18next/react-i18next already support additional locales; just add
#  "es-ES" to supportedLngs and create frontend/public/locales/es-ES/*.json)
```

```toml
# backend/pyproject.toml — add to [project] dependencies
"slowapi>=0.1.10",
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Direct Knowledge Base `retrieve` REST call via `httpx` for anonymous citations | Route anonymous chat through the existing Foundry Agent + `knowledge_base_retrieve` MCP tool (reuse `agent_chat_service.py` as-is) | Only if citations can be relaxed to "best-effort title mention in prose" rather than structured, clickable page/document links — not acceptable given the explicit "source separation" + "auditable" requirements in CLAUDE.md / `docs/requirements.md`. |
| `httpx` REST calls to the Search `retrieve` endpoint | `azure-search-documents` SDK (`azure.search.documents.knowledgebases.KnowledgeBaseRetrievalClient`, preview `11.7.0b2`; not confirmed whether GA `12.0.0` includes this module) | If the team later wants strong typing over the retrieve request/response instead of raw JSON, and is comfortable tracking a preview-versioned Azure SDK (this repo's own comment in `pyproject.toml` about `azure-ai-projects`'s `create_from_package` being removed is a cautionary precedent for preview SDK churn). |
| `openpyxl` for reading the CRM mapping XLSX | `pandas` (`pd.read_excel`) | Only if the mapping table grows beyond a simple flat lookup (e.g., needs joins/filters/aggregation before import) — unlikely for a POC "Excel-based mapping, no live CRM integration." |
| `slowapi` for anonymous-endpoint rate limiting | Azure API Management / Azure Front Door WAF rate limiting at the infra layer | For production hardening post-POC, or if multiple public endpoints need centrally managed limits — but that's a new Azure resource, more setup than the demo timeline allows now. |
| Custom lightweight store for guest session id | `zustand` | If anonymous-mode client state grows complex (multi-step wizards, cross-tab sync) beyond a session id + language — not the case here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Building citation extraction by prompt-engineering the Agent to emit `[ref: doc.pdf p.3]`-style markers in its free-text answer | The `knowledge_base_retrieve` MCP tool result is unstructured JSON-in-text (`ref_id` + `title` only, no URL/page), and LLMs are unreliable at consistently emitting exact machine-parseable markers — this produces broken/missing citations in production, not just occasionally. Confirmed via MS Learn: the MCP path has no `references`/`activity` envelope at all. | Direct `retrieve` REST call with `includeReferences=true`, `includeReferenceSourceData=true` — get citations as structured data, not scraped text. |
| `azure-search-documents` SDK just to make one `retrieve` call | Adds a second, preview-versioned Azure SDK to track for breaking changes, when the codebase has already standardized on raw `httpx` + REST for every other Search interaction (`knowledge_base_service.py`). Inconsistent patterns increase maintenance cost more than they save typing. | `httpx` against the documented REST endpoint, same auth helper already in `knowledge_base_service.py`. |
| `pandas` / `xlrd` for the CRM mapping import | Unnecessary heavy dependency (pandas pulls in numpy) for reading one small lookup sheet; `xlrd` no longer supports `.xlsx` (legacy `.xls` only) and would be the wrong tool regardless. | `openpyxl` (already installed). |
| Zustand/Redux for anonymous session state | Contradicts this repo's explicit "No Redux — use TanStack Query for server state, lightweight store for auth" convention; a session id + language preference doesn't need a state library. | Extend the existing custom store pattern (`frontend/src/stores/`). |
| Skipping rate limiting on the anonymous endpoint entirely | It is the only unauthenticated, LLM/Search-backed endpoint in the app — leaving it unlimited is a direct cost and availability risk once the demo link is shared externally. | `slowapi`, even a generous limit (e.g., 20 req/min/IP) is enough to blunt accidental abuse for a POC. |
| Assuming the Foundry IQ index's `sourceData`/semantic configuration already exposes a document URL and page number | Not verified in this pass — the retrieve action's `references[].sourceData` is only populated for whatever fields the underlying search index's semantic configuration and `sourceDataFields` actually project (see Gaps below). If the Phase 17 index doesn't include a blob URL / page field, citations will show titles but no working links. | Before implementing, inspect the actual index schema used by the existing Foundry IQ KB (Phase 17) and add a URL/page field to `sourceDataFields` if missing — this is an indexing-pipeline task, not a library choice. |

## Stack Patterns by Variant

**If anonymous mode needs spoken (avatar) output, not just text:**
- Do the `retrieve` call server-side first (with `outputMode: "answerSynthesis"` so Search's own LLM step produces one clean answer string), then feed that finished string into Azure Speech TTS / Voice Live for a single-shot utterance.
- Don't route anonymous voice through Voice Live → Agent → MCP-tool-KB, for the same citation-loss reason as text mode.

**If personalized (logged-in) mode later needs its own KB citations too:**
- Keep the existing Agent+MCP path for the conversational/CRM-injected behavior, but if citations become a requirement there as well, call `retrieve` in parallel (or first, then pass its `response` text into the Agent as context) rather than trying to extract citations from the Agent's own MCP-grounded reply.

**If Container Apps scales the backend beyond one replica:**
- Switch `slowapi`/`limits` storage from the in-memory default to Redis (Azure Cache for Redis), otherwise per-replica rate limits are effectively multiplied by replica count.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `slowapi==0.1.10` | Python `>=3.7,<4.0`, Starlette-based FastAPI `>=0.115.0` | No conflict with existing pinned FastAPI/Starlette versions. |
| `openpyxl>=3.1.2` (installed) / `3.1.5` (latest) | Python 3.11 | No breaking changes between 3.1.2→3.1.5 relevant to basic cell reads; safe to leave as-is or bump opportunistically. |
| Knowledge Retrieval REST `api-version=2026-05-01-preview` | Same Azure AI Search resource already used for `SEARCH_API_VERSION` in `knowledge_base_service.py` | Reuse that existing constant rather than hardcoding a second literal — keeps the whole codebase on one Search API version and one place to bump it later. |
| `i18next 25.10.5` / `react-i18next 16.6.2` | Adding `es-ES` locale | No version constraint; ensure the `ns` array in `frontend/src/i18n/index.ts` and the set of JSON files under `public/locales/es-ES/` stay in sync with `en-US`/`zh-CN` (14 namespaces today) — a missing namespace file silently falls back to `fallbackLng` (`en-US`) for that section only, which is easy to miss in review (see `.planning/debug/i18n-missing-zh-translations.md` for a prior instance of exactly this class of bug). |

## Sources

- `backend/app/services/knowledge_base_service.py` (repo) — existing Search REST/httpx auth pattern, `SEARCH_API_VERSION` constant, `build_search_tools`/MCPTool wiring — HIGH confidence (read directly)
- `backend/app/services/agent_chat_service.py` (repo) — existing Responses API `agent_reference` streaming pattern for the "text direct-to-Agent" path — HIGH confidence (read directly)
- `backend/app/dependencies.py`, `backend/app/models/user.py`, `backend/app/services/material_service.py`, `backend/app/services/skill_text_extractor.py`, `frontend/src/i18n/index.ts`, `frontend/src/stores/auth-store.ts` (repo) — confirmed no existing optional-auth dependency, no XLSX read path, no citation code anywhere, i18n `supportedLngs` currently `["en-US","zh-CN"]` only — HIGH confidence (read directly)
- [Agentic Retrieval Overview — Azure AI Search (Microsoft Learn, updated 2026-07-02)](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview) — confirms Foundry IQ is built on Search's agentic retrieval pipeline, and that it "can return source references and an activity log" — HIGH confidence (official docs, current)
- [Query Knowledge Base via API or MCP — Azure AI Search (Microsoft Learn, updated 2026-07-24)](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve) — **critical finding**: the `retrieve` REST/SDK action returns `response`/`activity`/`references` (with `docKey`, `sourceData`, `activitySource`), but the MCP tool result used by Foundry Agents does **not** return `activity`/`references` — only `result.content[].text` as a JSON-encoded string with `ref_id`/`title` — HIGH confidence (official docs, dated within the last week)
- PyPI: `slowapi` 0.1.10 (released 2026-06-13), `openpyxl` 3.1.5 (latest; 3.1.2 installed), `azure-search-documents` 12.0.0 GA / 11.7.0b2 preview (verified via `pip index versions` and `pypi.org` JSON API) — HIGH confidence (live registry query)

## Gaps to Address (before implementation, not blocking research)

- **Not verified:** whether the actual Foundry IQ knowledge base / search index created in v1.0 Phase 17 has `sourceDataFields`/semantic configuration that includes a document URL and page number. If not, the `retrieve` action's `references[].sourceData` will lack the fields needed to render a clickable "document link" — this needs a quick inspection of the live index schema (or a small indexer/skillset change) before the anonymous citation UI can be considered done, not just "returns something."
- **Not verified:** whether `azure-search-documents` 12.0.0 GA has folded in the `knowledgebases` module (only confirmed present in `11.7.0b1`/`b2` preview via docs) — irrelevant to the recommended `httpx` approach, but worth a five-minute check if the team ever wants the typed SDK later.

---
*Stack research for: AI Avatar Platform v2.0 Avatar MVP (anonymous grounded Q&A + citations, CRM-Excel personalization, es-ES i18n, avatar-first UI)*
*Researched: 2026-07-31*
