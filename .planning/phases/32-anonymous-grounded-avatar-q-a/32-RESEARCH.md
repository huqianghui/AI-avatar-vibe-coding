# Phase 32: Anonymous Grounded Avatar Q&A - Research

**Researched:** 2026-08-01
**Domain:** Anonymous auth/session issuance, FastAPI rate limiting, Azure AI Search agentic retrieval (citations), Azure Voice Live WebRTC (anonymous), React public routing
**Confidence:** MEDIUM (architecture HIGH, live-index citation completeness LOW/unverified, slowapi dual-key pattern MEDIUM)

## Summary

Phase 32 requires four largely independent subsystems that must be wired together: (1) an anonymous session-issuance layer that replaces JWT auth with a short-lived, server-signed token so no endpoint trusts client-supplied identifiers; (2) a citation-extraction path that is architecturally distinct from the existing Agent/MCP grounding flow, because the MCP `knowledge_base_retrieve` tool this codebase already uses returns **no structured citations at all** — only Azure AI Search's direct `retrieve` REST action does; (3) an anonymous variant of the existing Phase 29 WebRTC voice pipeline, reusing nearly all of its code but swapping the auth dependency and the per-HCP-profile agent resolution for a single fixed public agent; and (4) rate limiting via `slowapi`, which is entirely new to this codebase (no rate limiting exists anywhere today).

The single most important finding, confirmed twice (once via the internal `docs/microsoft-agent-framework/06-agent-tools-and-knowledge-grounding.md` and once via live Microsoft Learn docs fetched this session, dated 2026-07-24): **the Agent's MCP-based grounding path cannot supply structured citations** ("Unlike the retrieve action, the current MCP response doesn't return separate `activity` or `references` arrays" — direct quote from Microsoft Learn). This forces a "dual-query shadow retrieval" architecture: run the conversational Agent turn (via the existing `agent_chat_service.stream_agent_response()`, unchanged) concurrently with a separate `avatar_search_service.retrieve()` call against the same knowledge base's `retrieve` REST endpoint, purely to obtain `references[]` for the citation panel.

The second most important finding, and the one with the lowest confidence, is that **whether the live Foundry IQ knowledge source actually has `sourceDataFields` configured to include a document URL and page number is unknown and cannot be determined from documentation alone** — it depends entirely on how the specific Knowledge Source resource backing this project's index was defined, and `sourceDataFields` is a property of the **Knowledge Source definition itself** (set at index-setup time), not a parameter you can pass on the `retrieve` request. If it's missing, satisfying the user's locked "strict full-field citation" decision requires either an index/knowledge-source schema change (infra work) or a fallback of only ever returning citations when data happens to be complete — this must be verified against the live Azure resource before/during planning of implementation tasks, not assumed.

**Primary recommendation:** Build a new `avatar_service.py` orchestrator that fans out to `agent_chat_service.stream_agent_response()` (for the spoken/text answer) and a new `avatar_search_service.py` (httpx wrapper around the AI Search `retrieve` REST action, reusing `knowledge_base_service._search_auth_headers()`) concurrently, and gate the citation panel on all three required fields (title/URL/page) being present — verify the live knowledge source's `sourceDataFields` as a pre-implementation spike before committing to which fields are actually available.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**匿名入口与会话模型**
- 根路径即 avatar 页 — `/` 直接展示匿名 avatar 问答页，无需登录；登录入口放页角（不再默认跳 /login）
- 后端签发匿名 session token — `POST /public/avatar/session` 创建 `AnonymousAvatarSession` 记录，返回短期签名 token；后续所有匿名调用凭此 token，杜绝客户端自造标识
- 会话生命周期 — 无活动 30 分钟过期；前端静默重建新会话；配额按「会话 + IP」双重限制
- 公共知识库绑定由 Admin 界面配置 — 新增 `PublicKnowledgeConfig`（单例配置），复用 Phase 17 的 KB 列表/选择 UI；不用环境变量硬编码

**语音交互范围与成本**
- 输入方式：文本 + 麦克风语音提问 — 完整双向语音交互，不是纯文本输入
- 进页即连，数字人常驻 — 页面加载即建立 Voice Live 连接并展示数字人（展示效果优先于成本）
- 传输路径：WebRTC 直连 — 匿名场景走 WebRTC 直连路径；缓解措施：临时凭据必须短效期（short TTL）且只能凭有效匿名 session token 领取
- 不设全局并发上限 — 成本控制只靠限流（slowapi + 会话配额），不做并发闸门
- Admin 可配的公共 avatar 配置 — avatar 形象/风格 + 按语言的 neural voice 存入 `PublicKnowledgeConfig`（或同级公共配置），为 Phase 34 西语音色预留 per-language 结构
- 麦克风不可用时弹窗引导授权 — 主动弹窗解释用途并引导开启麦克风；授权失败后仍可文本提问
- 语音 + 文字同步展示 — 数字人说话的同时文字答案同步渲染（字幕/转写形式）

**来源引用展示与无匹配回退**
- 独立来源面板 — 页面侧边固定「参考来源」面板，随每次回答刷新当前引用；与回答气泡完全分离（成功标准 3）
- 每次回答最多展示 3 条引用 — 取相关度最高的前 3 条
- 引用严格要求全字段 — 每条引用必须有「标题 + 可点击 URL + 页码」才展示，缺任一字段整条不显示
- 无匹配固定拒答话术 — 检索无命中/低相关度时，数字人用预设多语言拒答模板回应，引用面板置空，零编造风险

### Claude's Discretion
- 限流与审计策略细节 — 按里程碑研究默认方案：slowapi（IP 级）+ 会话配额 + `AvatarInteractionLog` 审计模型；具体阈值、日志字段由规划/实现阶段定
- 拒答的相关度阈值判定方式（检索空结果 vs 低分截断）
- 前端会话静默重建的具体时机与 UX 细节
- 来源面板的视觉样式、加载态、空态设计

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (个性化、西语、legacy coach 隐藏本就属于 Phase 33–35).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANON-01 | 匿名访客无需登录即可打开 avatar 页面并以文本向数字人提问 | React router restructure (below), new `GET /` public route outside `ProtectedRoute`/`GuestRoute`; new `get_anonymous_session` FastAPI dependency + `POST /public/avatar/session` |
| ANON-02 | 匿名回答基于官网内容知识库（Foundry IQ 索引）grounding，仅使用授权知识来源 | Reuse existing MCPTool/Agent pattern from Phase 17 (`knowledge_base_service.build_search_tools`), bind to single public agent resolved from `PublicKnowledgeConfig` |
| ANON-03 | 每个回答附来源引用（page + document link），且与回答内容作为独立 UI 元素分离展示 | Dual-query shadow retrieval architecture (`avatar_search_service.py` + AI Search `retrieve` REST); **CRITICAL UNVERIFIED GAP**: live knowledge source `sourceDataFields`/URL+page availability |
| ANON-04 | 匿名访客可获得数字人语音回答（Voice Live avatar） | Reuse Phase 29 `voice_live_webrtc.py`/`use-voice-live-webrtc.ts`, new anonymous-token-authenticated variant of `/webrtc/session` |
| ANON-05 | 匿名端点具备限流与滥用防护（slowapi 限流 + 会话配额 + 交互审计日志） | `slowapi>=0.1.10` (new dependency, verified on PyPI), new `AnonymousAvatarSession`/`AvatarInteractionLog` models, dual IP+session key_func pattern (MEDIUM confidence, see Common Pitfalls) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Top-priority execution rule**: implement ONE requirement at a time (ANON-01 → ANON-02 → ... → ANON-05, not in parallel) → 100% unit test coverage for that requirement's new code → Playwright E2E covering its user story → all tests pass → commit → push → only then start the next requirement. Each requirement gets its own commit; never merge multiple requirements into one commit.
- All backend code is `async def`; use `AsyncSession` via `async with`; no bare `get_db()`.
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`.
- Exception raisers must be typed `-> NoReturn` (e.g. new `not_found()`/`bad_request()`-style helpers for anonymous-session errors).
- Static routes before parameterized routes in FastAPI routers.
- All new SQLAlchemy models MUST inherit `Base, TimestampMixin` (UUID str PK, `created_at`/`updated_at`).
- Schema changes MUST go through `alembic revision --autogenerate` → `alembic upgrade head`; never hand-edit or delete the DB file.
- No raw SQL — SQLAlchemy ORM or Alembic only.
- All routes under `/api/v1/` prefix EXCEPT this phase's explicitly-public endpoints, which the codebase already precedents as un-prefixed-by-auth (e.g. `/avatar-thumbnail/{character_id}`) — confirm with planner whether `/public/avatar/session` sits under `/api/v1/public/avatar/session` or a bare `/public/...` path; CONTEXT.md's literal `POST /public/avatar/session` suggests it may intentionally sit outside `/api/v1` to visually signal "no versioned API contract with auth", but this is a naming/routing decision the planner should make explicit, not silently default.
- Structured error responses: `{"code": "...", "message": "...", "details": {...}}` via `AppException` hierarchy — new rate-limit-exceeded and session-expired errors should follow this shape (slowapi's default `RateLimitExceeded` handler returns plain text; must wrap it).
- TypeScript strict mode, `@/` path alias, no inline `useQuery`, `cn()` for class composition.
- Pre-commit checklist: `ruff check .`, `ruff format --check .`, `pytest -v` (backend); `npx tsc -b`, `npm run build` (frontend) — CI will reject failures.
- English for commits/code/docstrings; Chinese for user-facing UI text where applicable (refusal templates, panel labels).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| slowapi | 0.1.10 [VERIFIED: PyPI `pip index versions slowapi`] | Rate limiting for FastAPI/Starlette | Thin wrapper over the `limits` library (Flask-Limiter's Starlette port); already recommended by milestone research SUMMARY.md as the one new dependency needed |
| python-jose[cryptography] | already installed [VERIFIED: `backend/pyproject.toml`] | Sign/verify short-lived anonymous session tokens | Already the JWT library in use for `get_current_user`; reuse rather than adding a second token library |
| httpx | already installed [VERIFIED: `backend/pyproject.toml`] | Direct call to AI Search `retrieve` REST action | Already used for `ASGITransport` testing and is the project's async HTTP client of choice |
| azure-ai-projects | 1.0.0b12 installed [VERIFIED: `pip show azure-ai-projects`] | Agent chat streaming (unchanged reuse) | Already powers `agent_chat_service.stream_agent_response()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `limits` (slowapi's transitive dep) | pulled in by slowapi | In-memory/Redis rate-limit storage backend | Default in-memory storage is sufficient for a single-instance dev/POC deployment; note for planner if horizontal scaling is a concern later (out of scope for this phase per CONTEXT.md — no concurrency gate requested) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| slowapi | fastapi-limiter (Redis-backed) | Requires Redis, which this codebase doesn't currently deploy; slowapi's in-memory default matches current infra with zero new services |
| Custom anonymous JWT | New dedicated `itsdangerous`-style signed token | Adds a second signing library for no benefit — python-jose already handles HMAC/RS256 signing and this codebase's `create_access_token` pattern can be adapted directly (shorter TTL, different claim set, e.g. `{"sid": session_id, "typ": "anon"}`) |

**Installation:**
```bash
cd backend
pip install slowapi>=0.1.10
# add to pyproject.toml [project.dependencies]
```

**Version verification:** `pip index versions slowapi` confirms `0.1.10` is latest as of this research session (2026-08-01); no newer release exists on PyPI at time of writing [VERIFIED: PyPI index, this session].

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── api/
│   └── public_avatar.py         # NEW: /public/avatar/session, /public/avatar/chat (or /webrtc/session variant)
├── dependencies.py               # ADD: get_anonymous_session (replaces get_current_user for public routes)
├── models/
│   ├── anonymous_avatar_session.py   # NEW: AnonymousAvatarSession(Base, TimestampMixin)
│   ├── avatar_interaction_log.py     # NEW: AvatarInteractionLog(Base, TimestampMixin)
│   └── public_knowledge_config.py    # NEW: PublicKnowledgeConfig(Base, TimestampMixin) — singleton row
├── services/
│   ├── avatar_service.py         # NEW: orchestrator — concurrent agent-chat + citation-retrieve + audit log write
│   ├── avatar_search_service.py  # NEW: httpx wrapper around AI Search `retrieve` REST action
│   ├── anonymous_session_service.py  # NEW: token issuance/verification, expiry, quota bookkeeping
│   └── rate_limit.py             # NEW: slowapi Limiter instance(s) + custom key_func(s)
└── main.py                       # ADD: app.state.limiter, exception_handler(RateLimitExceeded, ...), include public_avatar_router

frontend/src/
├── pages/
│   └── avatar-page.tsx           # NEW: root `/` page — digital human + input + mic + sources panel
├── components/avatar/
│   ├── sources-panel.tsx         # NEW: independent citation UI element
│   └── mic-permission-dialog.tsx # NEW: mic-unavailable guidance modal
├── hooks/
│   └── use-anonymous-avatar-session.ts  # NEW: session creation + silent renewal
└── router/index.tsx              # MODIFY: `/` → avatar-page (no guard), guest login moved to header link
```

### Pattern 1: Dual-Query Shadow Retrieval (citations)
**What:** Run the conversational Agent turn and a separate structured citation retrieval concurrently for the same user message, then merge: the Agent's streamed text becomes the spoken/displayed answer; the `retrieve()` REST call's `references[]` becomes the sources panel data — completely independent of what the Agent internally used via MCP.
**When to use:** Any time an Agent uses the MCP `knowledge_base_retrieve` tool for grounding but the UI needs structured, clickable citations — this is a structural gap in the MCP tool response format, not something fixable by prompting.
**Example:**
```python
# Source: MS Learn "Retrieve results in agentic retrieval" (fetched 2026-08-01, api-version=2026-05-01-preview)
# https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve
import asyncio
from app.services.agent_chat_service import stream_agent_response
from app.services.avatar_search_service import retrieve_citations

async def handle_turn(db, agent_name, agent_version, message, kb_name, previous_response_id=None):
    async def collect_agent_text():
        chunks = []
        response_id = None
        async for event in stream_agent_response(
            db, agent_name, agent_version, message, previous_response_id
        ):
            if event.kind == "text":
                chunks.append(event.text)
            elif event.kind == "completed":
                response_id = event.response_id
        return "".join(chunks), response_id

    (answer_text, response_id), references = await asyncio.gather(
        collect_agent_text(),
        retrieve_citations(kb_name=kb_name, query=message),
    )
    return answer_text, response_id, references
```

**REST shape for the citation call** (confirmed live via MS Learn, 2026-05-01-preview):
```http
POST {search-url}/knowledgebases/{knowledge-base-name}/retrieve?api-version=2026-05-01-preview
Content-Type: application/json
Authorization: Bearer {token}

{
    "messages": [
        {"role": "user", "content": [{"type": "text", "text": "<user question>"}]}
    ],
    "knowledgeSourceParams": [
        {"knowledgeSourceName": "<name>", "kind": "searchIndex"}
    ]
}
```
Response includes `response[].content[].text` (grounding text blob, not needed here), `activity[]` (query plan/telemetry), and **`references[]`** — each with `type`, `id`, `activitySource`, `docKey`, and `sourceData` (nullable; populated only when the underlying knowledge source config projects it — see Common Pitfalls #1).

### Pattern 2: Anonymous Session Token (replaces JWT for public routes)
**What:** A short-lived, server-signed token issued by `POST /public/avatar/session`, verified by a new `get_anonymous_session` dependency (parallel to `get_current_user`), never accepting client-supplied identifiers.
**When to use:** Every public-facing endpoint in this phase (`/public/avatar/session`, chat/text endpoint, WebRTC session issuance for anonymous users).
**Example:**
```python
# Adapted from backend/app/services/auth.py create_access_token pattern (python-jose, already installed)
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

ANON_TOKEN_TTL_MINUTES = 30  # matches CONTEXT.md 30-min inactivity expiry

def create_anonymous_token(session_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ANON_TOKEN_TTL_MINUTES)
    return jwt.encode(
        {"sid": session_id, "typ": "anon", "exp": expire},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )

async def get_anonymous_session(
    token: str = Header(..., alias="X-Anon-Session"),  # or Bearer, planner's call
    db: AsyncSession = Depends(get_db),
) -> AnonymousAvatarSession:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise unauthorized("Invalid or expired anonymous session")
    if payload.get("typ") != "anon":
        raise unauthorized("Wrong token type")
    session = await db.get(AnonymousAvatarSession, payload["sid"])
    if session is None or session.expires_at < datetime.now(timezone.utc):
        raise unauthorized("Session expired")
    return session
```
This is `[ASSUMED]` in its exact shape (header name, exact claim names) — it follows the existing `create_access_token`/`get_current_user` pattern closely enough to be low-risk, but the planner should decide Bearer-header vs custom-header, and whether "silent renewal" means the backend auto-issues a fresh token on any authenticated call within the last N minutes of TTL (sliding expiry) vs. the frontend simply calling `/public/avatar/session` again on 401 (fixed expiry, simpler, matches "前端静默重建新会话" wording more literally).

### Pattern 3: Dual-Key Rate Limiting (IP + Session)
**What:** slowapi's `Limiter` binds ONE `key_func` per instance. To get independent IP-level and session-level quotas (per CONTEXT.md "配额按「会话 + IP」双重限制"), stack two separate `Limiter` instances as two decorators on the same route, or write a composite `key_func` that returns a single combined key — the two approaches give different semantics (see Common Pitfalls #3).
**When to use:** Every anonymous-facing POST endpoint (session creation, chat turn, WebRTC session issuance).
**Example:**
```python
# [ASSUMED — MEDIUM confidence; slowapi's own docs/README do not show this exact multi-limiter
# pattern explicitly, only "multiple limit decorators" and "shared limits across routes" in
# generic terms. Verify with a smoke test during Wave 0 that two decorators from two distinct
# Limiter instances both actually enforce independently on the same route.]
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_session_key(request: Request) -> str:
    return request.headers.get("X-Anon-Session", get_remote_address(request))

limiter_ip = Limiter(key_func=get_remote_address)
limiter_session = Limiter(key_func=get_session_key)

@router.post("/public/avatar/chat")
@limiter_ip.limit("20/minute")
@limiter_session.limit("60/hour")
async def chat(request: Request, ...):
    ...
```
`app.state.limiter` (used by the default `_rate_limit_exceeded_handler`) should be set to whichever limiter instance is registered for the app-wide exception handler; both limiters raise the same `slowapi.errors.RateLimitExceeded` exception type, so ONE `app.add_exception_handler(RateLimitExceeded, custom_handler)` covers both — but this custom handler must be written to match the project's `{"code", "message", "details"}` error shape rather than slowapi's default plain-text response.

**Known limitation** [CITED: github.com/laurentS/slowapi README, fetched 2026-08-01]: slowapi explicitly does **not** support WebSocket endpoints, and requires the `request: Request` parameter to be present in the decorated function's signature or it silently fails to enforce. This does not block Phase 32 (the anonymous voice path is WebRTC via a REST session-issuance endpoint plus a browser-native `RTCDataChannel`, not the app's own `/ws` WebSocket route), but it does mean the existing authenticated `/ws` endpoint pattern in `voice_live.py` could never be rate-limited by slowapi if a future phase reuses it for anonymous users — flag this if any future WS-based anonymous path is considered.

### Anti-Patterns to Avoid
- **Trusting the MCP tool's text response as a citation source:** it returns a JSON-encoded string blob with `ref_id`/`title`/`terms`/`content` for LLM grounding, not a queryable structured array — parsing it as citations is fragile and was explicitly the "citations are easy to fake" pitfall flagged in `research/SUMMARY.md`.
- **Letting the anonymous chat endpoint accept `agent_id`/`hcp_profile_id`/`kb_name` from the request body:** violates the explicit "no endpoint accepts client-supplied agent/profile identifiers" phase boundary. The endpoint must resolve everything server-side from `PublicKnowledgeConfig`.
- **Applying `Depends(get_current_user)` with `auto_error=False` as a shortcut for "optional auth":** `research/SUMMARY.md` explicitly flags this as Pitfall 3 — anonymous access must be a genuinely separate trust boundary (a new dependency, new session model), not an authenticated-path-with-auth-made-optional, or a bug could let an anonymous caller access personalized data paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting / abuse throttling | Custom in-memory counter dict + manual sliding window | `slowapi` | Correct sliding-window/fixed-window semantics, tested, integrates with FastAPI's exception-handler system |
| Anonymous token signing | New signing scheme (HMAC from scratch, custom base64 envelope) | `python-jose` (already a dependency) with a distinct `typ: "anon"` claim | Avoids maintaining two crypto code paths; reuses vetted library already in `auth.py` |
| Citation extraction from LLM text | Regex/string-matching on the agent's answer to guess source titles | AI Search `retrieve` REST `references[]` array | The REST action is the only Azure-native structured citation mechanism; hand-parsed citations will fabricate or miss sources, violating the "zero fabrication" locked decision |
| WebRTC signaling/ICE/SDP handling | New WebRTC client code | Reuse `voice_live_webrtc.py` + `use-voice-live-webrtc.ts` from Phase 29 unchanged (only swap the auth/session-resolution layer) | This is a fully working, tested implementation already; duplicating it for anonymous risks drift and doubles the maintenance surface |

**Key insight:** Nearly everything hard in this phase (WebRTC transport, agent chat streaming, MCP-based grounding) already exists and works — the phase is really about building a new *trust boundary* (anonymous session + rate limiting) and a new *citation data path* (retrieve REST) around existing machinery, not building new AI/voice plumbing from scratch.

## Common Pitfalls

### Pitfall 1: `sourceData` in `references[]` may not include URL or page number — and it's not a request-time toggle
**What goes wrong:** Assuming you can just pass `includeReferenceSourceData: true` on the retrieve request and get URL+page back.
**Why it happens:** Per Microsoft Learn (fetched 2026-08-01): "Query execution uses the knowledge source definition, including `semanticConfigurationName`, `searchFields`, and **`sourceDataFields`**." `sourceDataFields` is configured on the **Knowledge Source resource itself** (an index-setup-time concept), not passed per-query. Additionally, the docs state `sourceData` fields are driven by the **semantic configuration** (commonly just `title`/`terms`/`content`) unless the knowledge source was explicitly built to project more fields (e.g. a `url` or `page` field mapped in at ingestion time).
**How to avoid:** Before implementation, call `GET {search-url}/knowledgesources/{name}?api-version=2026-05-01-preview` (or the equivalent list/get on the live resource) to inspect the actual `sourceDataFields` list and semantic configuration bound to the public KB. If URL/page are absent, this phase must include either (a) an index/knowledge-source schema update task (requires re-indexing or at minimum updating the knowledge source definition + verifying existing documents were ingested with those fields available), or (b) an explicit product decision to relax "strict full-field" — but CONTEXT.md locks strict full-field, so (a) is very likely required. **This is the single highest-risk unresolved item for phase planning.**
**Warning signs:** `references[].sourceData` comes back `null` (as in Microsoft's own documented example) or with only `title`/`terms`/`content` and no URL/page field.

### Pitfall 2: MCP tool response has no `activity`/`references` — confirmed, not assumed
**What goes wrong:** Trying to extract citations from the same Agent call already used for grounding, to "save a request."
**Why it happens:** Two independent grounding mechanisms exist on the same Azure AI Search Knowledge Base resource — the MCP tool (`knowledge_base_retrieve`, used by Agents/Prompt Agents) and the direct `retrieve` REST/SDK action. Per Microsoft Learn: "the current MCP response doesn't return separate `activity` or `references` arrays" — only `result.content[]` (a text blob).
**How to avoid:** Always issue the second, independent `retrieve()` call purely for citations, as in Pattern 1 above. Do not try to optimize this away.
**Warning signs:** N/A — this is a hard API limitation, not a misconfiguration.

### Pitfall 3: slowapi dual-limiter pattern is unverified against this exact use case
**What goes wrong:** Assuming two `Limiter` instances decorating the same route definitely enforce two independent windows without any interference, purely from general library-feature-list documentation.
**Why it happens:** slowapi's official docs (PyPI, readthedocs, GitHub README) describe "multiple limit decorators" and "shared limits across routes" as features but do not show the specific two-separate-`Limiter`-instances-with-different-key-funcs-on-one-route pattern with example code — this pattern is `[ASSUMED]` from general `limits`/Flask-Limiter ecosystem knowledge, not confirmed against slowapi's current README.
**How to avoid:** Write a fast smoke/unit test in Wave 0 that hits a test route enough times to trip only the IP limit, and separately enough to trip only the session limit, asserting each triggers independently with different mock IPs/session headers.
**Warning signs:** Rate limit either double-triggers unexpectedly or one of the two limiters silently never fires.

### Pitfall 4: Router-level auth assumptions are pervasive, not localized to one file
**What goes wrong:** Fixing only `frontend/src/router/index.tsx`'s `/` redirect and missing other places that assume "always authenticated."
**Why it happens:** `research/SUMMARY.md` (Pitfall 1) already flagged that `ConfigProvider` and similar app-wide providers resolve feature flags/config `if (isAuthenticated)` with no anonymous branch.
**How to avoid:** Grep for `isAuthenticated`, `useAuthStore`, and `useMe` across `frontend/src/` before finalizing the new public route tree; any provider gating global app config on auth needs an anonymous-safe default path.
**Warning signs:** Avatar page renders blank/errors for anonymous users because a top-level provider assumed a user object exists.

### Pitfall 5: Cost exposure from "connect on page load, no concurrency cap"
**What goes wrong:** Every anonymous page visit — including bots/crawlers/repeated reloads — immediately opens a Voice Live WebRTC session and starts consuming premium Azure AI Avatar / Speech minutes, with the only backstop being rate limiting (no concurrency gate, per locked decision).
**Why it happens:** This is an explicit, informed tradeoff the user made ("展示效果优先于成本"), not an oversight — but it means the ephemeral-credential short-TTL requirement and the session+IP quota are the *only* cost controls, and both must be tuned conservatively and be easy to adjust without a redeploy (config-driven, not hardcoded).
**How to avoid:** Make TTL and quota thresholds `Settings` fields (env-overridable), not inline constants, and audit-log every session creation (`AvatarInteractionLog` or `AnonymousAvatarSession` itself) with enough detail to detect abuse patterns after the fact even though there's no real-time concurrency gate.
**Warning signs:** N/A at build time — this is an operational risk to monitor post-launch, not a bug to fix now.

## Code Examples

### Reusable auth-header helper for the retrieve REST call
```python
# Source: backend/app/services/knowledge_base_service.py (existing, read this session)
# _search_auth_headers(search_key) already tries API key first, falls back to Entra ID
# bearer token via azure_auth.get_bearer_token(SEARCH_TOKEN_SCOPE). Reuse directly in
# avatar_search_service.py rather than reimplementing auth.
async def _search_auth_headers(search_key: str | None) -> dict[str, str]:
    if search_key:
        return {"api-key": search_key}
    token = await azure_auth.get_bearer_token(SEARCH_TOKEN_SCOPE)
    return {"Authorization": f"Bearer {token}"}
```

### Retrieve URL construction (mirrors existing MCP URL builder)
```python
# Existing pattern in knowledge_base_service.py:
# _build_kb_mcp_url(connection_target, index_name) ->
#   f"{endpoint}/knowledgebases/{index_name}/mcp?api-version={SEARCH_API_VERSION}"
# New equivalent for avatar_search_service.py:
SEARCH_API_VERSION = "2026-05-01-preview"  # matches retrieve action's documented version

def _build_kb_retrieve_url(endpoint: str, kb_name: str) -> str:
    return f"{endpoint}/knowledgebases/{kb_name}/retrieve?api-version={SEARCH_API_VERSION}"
```
Note: `knowledge_base_service.py` currently hardcodes `SEARCH_API_VERSION = "2026-05-01-preview"` for its own MCP-URL builder too — this is a fortunate coincidence that both the MCP endpoint and the retrieve endpoint the codebase needs share the same api-version string; confirm this stays true rather than assuming it forever.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `intents: [{"type": "semantic", "search": "..."}]` request body (api-version 2026-04-01) | `messages: [{"role": "user", "content": [{"type": "text", "text": "..."}]}]` (api-version 2026-05-01-preview) | 2026-05-01-preview | New code should use the `messages` shape; the codebase's `SEARCH_API_VERSION` constant already targets 2026-05-01-preview, so use `messages`, not `intents` |

**Deprecated/outdated:** None directly relevant found beyond the intents→messages request-shape change above; `2026-05-01-preview` is itself a preview API — confirm before locking a phase-long dependency on it that it's still the intended target (the codebase's existing `SEARCH_API_VERSION` constant already commits to it for MCP URLs, so consistency favors reusing it here too, but preview APIs can change without notice).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Anonymous token delivered via a custom header (e.g. `X-Anon-Session`) rather than `Authorization: Bearer` | Pattern 2 | Low — purely a naming/transport choice the planner can freely override; does not affect architecture |
| A2 | "Silent session renewal" means a fresh `POST /public/avatar/session` call on 401/expiry, not sliding-expiry token refresh | Pattern 2 | Medium — if the user actually wants sliding expiry (session extends on activity, never truly expires while active), the 30-min "no activity" wording in CONTEXT.md supports sliding expiry more than fixed expiry; planner should clarify semantics as a task detail, not assume fixed-window |
| A3 | Two separate `slowapi.Limiter` instances with different `key_func`s can be stacked as two decorators on one FastAPI route and both enforce independently | Pattern 3 / Common Pitfalls #3 | Medium — if this doesn't work as expected, dual IP+session quota needs a different implementation (e.g. one limiter with a composite key, or manual DB-backed counting via `AnonymousAvatarSession`) |
| A4 | `sourceDataFields`/semantic config on the live project's Foundry IQ knowledge source is unlikely to already include URL + page number | Pitfall 1 | High — this is the phase's biggest risk; if wrong (fields ARE present), the phase is much simpler; if right (fields are absent), this phase needs an index-schema remediation task not yet scoped anywhere |
| A5 | `/public/avatar/session` sits outside the `/api/v1/` prefix as CONTEXT.md's literal path suggests | Project Constraints | Low — purely a routing convention question; easy to correct at planning time |

**If this table is empty:** N/A — see entries above; A4 is the item most requiring user/planner attention before implementation tasks are finalized.

## Open Questions

1. **Does the live Foundry IQ knowledge source's `sourceDataFields` include a document URL field and a page-number field?**
   - What we know: `sourceData` fields are driven by the knowledge source's semantic configuration + `sourceDataFields` list, set at knowledge-source-definition time, not at query time. Microsoft's own documented example shows `sourceData: null` and, when populated in other examples, only generic `title`/`terms`/`content`.
   - What's unclear: This project's specific KB/knowledge-source configuration — cannot be verified without live Azure resource access (`GET /knowledgesources/{name}?api-version=2026-05-01-preview` or Portal inspection).
   - Recommendation: Treat as a Wave-0/spike task in the implementation plan — call the live endpoint (or inspect via Azure Portal) before committing to whether ANON-03's "strict full-field citation" is achievable without an index-schema change.

2. **Where does the page-number field even come from, if the source documents are e.g. PDFs?**
   - What we know: Azure AI Search index-based knowledge sources project whatever fields exist in the underlying index; a "page number" typically requires the index to have been built with page-level chunking (one document/chunk per page, with a `page` field) — this is an ingestion-pipeline characteristic, not something added after the fact via query parameters.
   - What's unclear: Whether the official-website-content index behind this project was built with page-level granularity at all, or with different (e.g. whole-document or byte-range) chunking.
   - Recommendation: Same spike as above should also confirm chunking granularity; if the index was built without page tracking, "page number" citations may require re-ingestion, which is a larger scope item the planner needs to flag explicitly to the user rather than silently descoping.

3. **Exact transport for the anonymous session token (header name, Bearer vs custom) and whether renewal is sliding or fixed-window.**
   - What we know: CONTEXT.md specifies 30-min inactivity expiry and "前端静默重建新会话" (frontend silently rebuilds a new session).
   - What's unclear: Whether "rebuild" means issuing a brand-new session (losing conversation continuity/`previous_response_id`) or extending the existing one.
   - Recommendation: Planner should make this an explicit task-level decision; recommend fixed-window with a new session on renewal (simpler, matches literal wording "重建新会话" = "rebuild a NEW session") unless conversation continuity across silent renewal is a hidden requirement — confirm with user if ambiguous.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend runtime | ✓ | 3.11.9 | — |
| Node.js 20+ | Frontend build/test | ✓ | v25.9.0 (exceeds minimum) | — |
| npm | Frontend package management | ✓ | 11.12.1 | — |
| pip | Backend package management | ✓ | 24.0 | — |
| slowapi | ANON-05 rate limiting | ✗ (not yet installed) | 0.1.10 available on PyPI | None needed — trivial `pip install`, no infra dependency |
| Docker | Optional containerized dev | ✗ (`command not found`) | — | Not required — CLAUDE.md confirms local dev works without Docker (`uvicorn --reload` + `npm run dev`) |
| Azure AI Search (live resource) | Citation retrieve REST verification (Open Question 1/2) | Unknown — not probed this session (would require live credentials/endpoint) | — | None — this MUST be verified during Wave 0 of implementation, not assumable from research alone |

**Missing dependencies with no fallback:**
- None blocking — slowapi installs trivially; the live Azure Search resource check is a Wave-0 implementation task, not an environment blocker for planning.

**Missing dependencies with fallback:**
- Docker (not required for local dev per project conventions).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.3+ with `pytest-asyncio` (`asyncio_mode = "auto"`), `pytest-cov` (`--cov-fail-under=89`) |
| Framework (frontend unit) | vitest (`frontend/vitest.config.ts`) |
| Framework (E2E) | Playwright (`frontend/e2e/playwright.config.ts`) |
| Config file (backend) | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Config file (frontend) | `frontend/vitest.config.ts`, `frontend/e2e/playwright.config.ts` |
| Quick run command (backend) | `cd backend && pytest -v -k anonymous_avatar` (or targeted file, e.g. `pytest tests/test_public_avatar_api.py -v`) |
| Quick run command (frontend) | `cd frontend && npm run test -- avatar-page` |
| Full suite command (backend) | `cd backend && pytest -v` |
| Full suite command (frontend) | `cd frontend && npm run test && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANON-01 | Anonymous visitor loads `/` without redirect, sees avatar page, can submit text question | unit + e2e | `pytest tests/test_public_avatar_api.py -x`; `npx playwright test e2e/anonymous-avatar-qa.spec.ts` | ❌ Wave 0 |
| ANON-02 | Answer is grounded in the configured public KB only; refuses when no match | unit | `pytest tests/test_avatar_service.py -x` | ❌ Wave 0 |
| ANON-03 | Response includes ≤3 citations, each with title+URL+page, or empty panel | unit | `pytest tests/test_avatar_search_service.py -x` | ❌ Wave 0 |
| ANON-04 | Anonymous WebRTC session issuance returns valid signaling config; avatar speaks | unit + e2e | `pytest tests/test_public_webrtc_session.py -x`; `npx playwright test e2e/anonymous-avatar-voice.spec.ts` | ❌ Wave 0 |
| ANON-05 | Repeated requests beyond threshold are rejected with structured 429; interactions are logged | unit | `pytest tests/test_rate_limiting.py -x`; `pytest tests/test_avatar_interaction_log.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `pytest -k <requirement>` / `npm run test -- <component>` (per CLAUDE.md's one-requirement-at-a-time rule)
- **Per wave merge:** full backend `pytest -v` + full frontend `npm run test && npm run test:e2e`
- **Phase gate:** Full suite green (including `--cov-fail-under=89` maintained) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_public_avatar_api.py` — covers ANON-01, ANON-02
- [ ] `backend/tests/test_avatar_service.py` — covers ANON-02 (dual-query orchestration, refusal logic)
- [ ] `backend/tests/test_avatar_search_service.py` — covers ANON-03 (citation retrieval + full-field gating)
- [ ] `backend/tests/test_public_webrtc_session.py` — covers ANON-04 (anonymous WebRTC session issuance)
- [ ] `backend/tests/test_rate_limiting.py` — covers ANON-05 (dual-limiter smoke test per Pitfall 3)
- [ ] `backend/tests/test_avatar_interaction_log.py` — covers ANON-05 (audit log write-path)
- [ ] `frontend/src/pages/avatar-page.test.tsx`, `frontend/src/components/avatar/sources-panel.test.tsx` — new component coverage
- [ ] `frontend/e2e/anonymous-avatar-qa.spec.ts`, `frontend/e2e/anonymous-avatar-voice.spec.ts` — new E2E user stories (text Q&A path, voice path)
- [ ] `backend/tests/conftest.py` — may need a new fixture for creating a fake `AnonymousAvatarSession` (parallel to existing `_create_user_and_token` helper pattern seen in `test_voice_live_webrtc.py`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial — anonymous sessions are not "authentication" in the traditional sense, but the issued token functions as a bearer credential | python-jose signed token with short TTL, `typ` claim discriminating anon vs user tokens |
| V3 Session Management | Yes | 30-min inactivity expiry, server-side session record (`AnonymousAvatarSession`) as source of truth, not just client-trusted token claims |
| V4 Access Control | Yes | No endpoint accepts client-supplied `agent_id`/`hcp_profile_id`/`kb_name`; server resolves the single public agent/KB from `PublicKnowledgeConfig` exclusively |
| V5 Input Validation | Yes | Pydantic v2 schemas on all new request bodies; message length limits on chat input (prevent oversized prompt-injection/DoS payloads) |
| V6 Cryptography | Yes — never hand-roll | Reuse `python-jose` (already vetted, already a dependency) for token signing; do not invent a new signing scheme |
| V7 Error Handling / Logging | Yes | `AvatarInteractionLog` for every interaction (traceable knowledge source per response, per CLAUDE.md AI Avatar Domain Rule 7); structured error responses wrapping slowapi's `RateLimitExceeded` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges/replays a session token or fabricates its own identifiers | Spoofing / Tampering | Server-signed token verified via `get_anonymous_session`; DB-backed session record checked for expiry on every call, not just token `exp` claim |
| Anonymous endpoint spam (session creation flood, chat flood, WebRTC session flood) | Denial of Service | slowapi dual IP+session quota (Pattern 3); short-TTL ephemeral WebRTC credentials limit blast radius of any leaked credential |
| Citation panel accidentally surfaces non-public/internal KB content | Information Disclosure | Public chat path is hard-bound to `PublicKnowledgeConfig`'s single designated KB only — never reuse the per-HCP-profile KB resolution logic used by the authenticated path |
| Fabricated or incomplete citations presented as authoritative | Information Disclosure / Repudiation risk (false trust) | Strict full-field gating (title+URL+page all present or the whole citation is dropped) — already locked by user decision; implement as a hard filter in `avatar_search_service.py`, not a UI-layer suggestion |
| No audit trail for anonymous interactions | Repudiation | `AvatarInteractionLog` on every turn — session id, question, answer summary, citations returned, refusal flag |
| Prompt injection via anonymous free-text input reaching the Agent's system prompt context | Tampering | Out of direct scope for Phase 32 (CONTEXT.md's PII/prompt-injection sanitization note is explicitly attached to PERS-02 in Phase 33, not ANON-02) — but basic length/charset validation on anonymous input is still reasonable defense-in-depth here |

## Sources

### Primary (HIGH confidence)
- Microsoft Learn — "Retrieve results in agentic retrieval" (https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve), fetched 2026-08-01, content dated 2026-07-24 update — confirms `retrieve` REST request/response shape, `references[]`/`activity[]` structure, MCP-vs-retrieve citation gap, `sourceDataFields`/semantic-config dependency for `sourceData` population
- PyPI — `slowapi` package page (https://pypi.org/project/slowapi/), `pip index versions slowapi` — confirms 0.1.10 is current
- Codebase (this session, direct Read): `backend/app/dependencies.py`, `backend/app/api/voice_live.py`, `backend/app/services/knowledge_base_service.py`, `backend/app/services/voice_live_webrtc.py`, `frontend/src/hooks/use-voice-live-webrtc.ts`, `frontend/src/router/auth-guard.tsx`, `frontend/src/router/index.tsx`, `backend/app/main.py`, `backend/app/models/base.py`, `backend/app/config.py`, `backend/pyproject.toml`, `backend/app/services/agent_chat_service.py`, `backend/app/models/hcp_knowledge_config.py`, `frontend/src/components/admin/knowledge-tab.tsx`, `backend/tests/test_voice_live_webrtc.py`, `backend/tests/test_knowledge_base.py`

### Secondary (MEDIUM confidence)
- GitHub `laurentS/slowapi` (via WebFetch, fetched 2026-08-01) — confirms `request: Request` parameter requirement, WebSocket unsupported, "multiple limit decorators" feature exists but without concrete multi-limiter code example
- readthedocs `slowapi.readthedocs.io` (via WebFetch, fetched 2026-08-01) — confirms basic `Limiter`/`add_exception_handler` setup pattern and decorator-ordering gotcha
- Internal doc `docs/microsoft-agent-framework/06-agent-tools-and-knowledge-grounding.md` (already verified per its own annotations against live testing) — corroborates MCP-tool citation gap independently of the Microsoft Learn fetch

### Tertiary (LOW confidence)
- Dual-`Limiter`-instance stacking pattern for independent IP+session quotas (Pattern 3, Assumption A3) — general `limits`/Flask-Limiter ecosystem knowledge, not confirmed against slowapi's current docs with a matching code example; flagged for a Wave-0 smoke test

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — slowapi version/existence HIGH confidence, but exact dual-key integration code pattern is LOW/ASSUMED
- Architecture (citation dual-query, WebRTC reuse, anonymous session): HIGH for the overall shape (multiply-corroborated), LOW for live-index citation-field completeness (genuinely unknowable without live resource access)
- Pitfalls: HIGH — each pitfall is either a direct documentation quote or a direct codebase read, not inference

**Research date:** 2026-08-01
**Valid until:** 30 days for the slowapi/architecture findings (stable library); the Azure AI Search `2026-05-01-preview` API surface should be re-checked if implementation slips more than ~4-6 weeks, since preview APIs can change without notice
