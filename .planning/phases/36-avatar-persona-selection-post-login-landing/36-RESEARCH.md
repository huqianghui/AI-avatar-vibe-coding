# Phase 36: Avatar Persona Selection & Post-Login Landing - Research

**Researched:** 2026-08-02
**Domain:** Full-stack CRUD entity (backend+frontend) + prompt-injection extension + route-redirect change, on top of an existing FastAPI/SQLAlchemy/React codebase. Narrow external dependency: Azure AI Speech standard-avatar catalog + azure-ai-voicelive SDK `AvatarConfig` contract.
**Confidence:** HIGH (codebase patterns) / MEDIUM (external avatar catalog currency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions (user-approved 2026-08-02)

### Persona 实体与管理 (PERSONA-01/02)
- **D-01: 新增 `AvatarPersona` 实体** — 字段：name、Azure prebuilt avatar `character` + `style`、per-language voice（复用/对齐 Phase 34 voice_map 的 locale→voice 机制）、greeting（问候语）、persona prompt 片段、`enabled` flag、`is_default` 标记；管理员全 CRUD，普通用户只读列表（`GET /api/v1/personas` 仅返回 enabled 项）
- **D-02: 唯一默认约束** — 启用的 Persona 中有且仅有一个 default；禁用 default 或删除 default 时必须先转移默认标记（服务层守卫）；系统 seed 至少一个默认 Persona 保证匿名路径永不落空
- **D-03: 仅 Azure 预置角色** — character/style 从静态常量列表选择（前端已有 AVATAR_VIDEO_CHARACTERS 常量先例，Phase 12）；不做 Custom Avatar、不做头像上传训练

### 用户选择与切换 (PERSONA-03)
- **D-04: `selected_persona_id` 挂在 Phase 33 用户偏好存储** — 不新建用户级表；管理员偏好打标签 UI 处可见
- **D-05: 页内切换入口，切换即重建会话** — avatar 页内提供 persona 切换入口（非独立页面）；切换语义与 Phase 34 西语切换一致：重建 Voice Live 会话，不做 mid-session 热切换
- **D-06: 无强制选择页** — 登录后不弹选择流程；未选择用户直接用默认 Persona；用户可随时页内更换

### 会话应用 (PERSONA-04)
- **D-07: 会话凭据/配置端点按 active persona 解析** — 匿名与登录路径的 WebRTC/session 端点根据 persona 输出 character/style/voice；per-language voice 与用户当前 locale 结合（persona 的 locale→voice map 优先，缺失时回退 Phase 34 voice_map / DEFAULT_PUBLIC_VOICE_BY_LOCALE）
- **D-08: persona prompt 片段随既有注入管道进入 system prompt** — 登录路径与 PERS-02 的 CRM/偏好注入合并，复用既有 prompt-injection/PII sanitization 双闸；匿名路径仅注入 persona 片段（不含任何用户数据）；greeting 在会话建立后由数字人播报

### 登录落地 (LAND-01)
- **D-09: 普通用户登录后落 `/`（avatar 页），admin 仍落 `/admin/dashboard`** — 修改 `GuestRoute`/`login.tsx` 重定向目标；**有意更新 `routing.spec.ts` 的 `toHaveURL(/\/user\/dashboard/)` 断言**（Phase 35 D-04 的"不动重定向"约束在本 phase 被明确解除，这是本需求的字面内容）
- **D-10: 旧 coach 路由不动** — `/user/dashboard` 等仍可直接 URL 访问（Phase 35 D-03 延续）；只改登录后的默认落点

### Claude's Discretion
- AvatarPersona 的 DB schema 细节（voice map 存 JSON column vs 关联表）、Alembic 迁移设计
- thumbnail 处理（建议：按 character 用静态预览图，不做上传）
- persona 切换入口的具体 UI（下拉/侧栏/dialog）与位置 — 由 UI-SPEC 定
- admin persona 管理页放 settings 还是独立 admin 路由
- seed 默认 Persona 的具体角色/语音选择
- i18n：admin/用户面 UI 文案需补全 5 locale（zh-CN/en-US/es-ES/es-MX/es-US）+ key-parity（whitelist 已 15/15 满，不得新增豁免）

### Deferred Ideas (OUT OF SCOPE)
- Custom Avatar（训练自有形象）— 成本高，POC 不做
- Persona 级知识库绑定（不同 persona 不同知识源）— 未提出，暂不做
- 自动偏好抽取（PERS-04）、真实 CRM（PERS-05）、删除 coach 代码（CLEAN-01）— 维持 future
</user_constraints>

## Summary

Phase 36 is >90% "assemble existing, proven in-repo patterns" and <10% "verify one external contract." Every one of D-01 through D-10's mechanics has a direct precedent already merged in this codebase: singleton-JSON-map admin config (Phase 34 `voice_map`), IDOR-safe dual-filter preference CRUD (Phase 33 `admin_user_preferences.py`), chat-time single-string `developer`-role prompt injection with a two-gate sanitizer (Phase 33 `personalization_injection_service.py`), and character/style cascading-select admin UI (Phase 12/16 `vl-instance-dialog.tsx` + `AVATAR_CHARACTERS` constant). The two real risks are architectural, not informational: (1) the `/` avatar page's voice pipeline is **audio-only** (direct WebRTC, no avatar video track anywhere in `avatar-page.tsx`/`use-anonymous-voice-live.ts`/`use-voice-live-webrtc.ts`) — PERSONA-04's "session actually uses persona's character/style" can only be satisfied for **voice**, not video rendering, without a much larger transport change that is NOT in scope per 36-CONTEXT.md; and (2) `UserPreference` is a multi-row-per-category table by design, so storing a single-valued `selected_persona_id` needs an explicit upsert-by-category service function, not a plain `INSERT`.

External verification confirms the in-repo `AVATAR_VIDEO_CHARACTERS` constant (Harry/Jeff/Lisa/Lori/Max/Meg) is accurate for the actor-licensed full-body avatars but is **stale**: current Microsoft Learn docs (checked 2026-08-02) list 4 additional full-body avatars (Rowan, Celine, Nia, Malik — no styles, "N/A") not present in `avatar_characters.py`, and flag that **the Jeff avatar retires starting December 2026**. The `AVATAR_PHOTO_CHARACTERS` (30-entry "talking heads") list matches current docs exactly. The installed `azure-ai-voicelive==1.3.0b1` SDK's `AvatarConfig` model was inspected directly (not guessed) and confirms `character` + `style` + `video`/`scene`/`output_protocol` fields — this is the eventual target shape if video-avatar wiring is ever added, but Persona's DB schema only needs to store `character`/`style` strings, not construct `AvatarConfig` objects (that only happens inside `voice_live_websocket.py`, which this phase does not touch per the audio-only scope decision below).

**Primary recommendation:** Build `AvatarPersona` as a plain multi-row CRUD table (SQLAlchemy model + Alembic migration, next unused unused letter-prefix after `d37a`) with a `Text` JSON column for the per-locale voice map (mirroring `PublicKnowledgeConfig.voice_map`), a service-layer unique-default guard (mirroring no existing precedent — write new, small, single-transaction guard), and resolve character/style/voice + persona-prompt-fragment injection only into the **existing audio pipeline** (`create_public_webrtc_session_config` / `create_webrtc_session_config` for voice-name resolution, `build_personalization_context`-adjacent helper for prompt-fragment concatenation). Do not attempt to wire true avatar video rendering into `avatar-page.tsx` — that is a separate, much larger transport-architecture project outside PERSONA-04's literal scope given the existing hardcoded `avatarEnabled: false` / `isDigitalHumanMode={false}` throughout the anonymous+personalized avatar-page code path.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSONA-01 | Admin CRUD persona catalog (name, character+style, per-language voice, greeting/prompt fragment, enabled) | `AvatarPersona` model design (Architecture Patterns §1), admin API precedent (`admin_public_knowledge_config.py`), admin UI precedent (`user-personalization-dialog.tsx`, `vl-instance-dialog.tsx` character/style cascade) |
| PERSONA-02 | Exactly one default among enabled personas | Unique-default service-layer guard pattern (Common Pitfalls §1), seed-data requirement |
| PERSONA-03 | Logged-in in-page persona switch, persists as `selected_persona_id`, rebuild session | `UserPreference` upsert-by-category pattern (Common Pitfalls §2), session-rebuild precedent (Phase 34 language-switch convention in `use-anonymous-voice-live.ts`/`use-voice-live-webrtc.ts` `connect()` re-invocation) |
| PERSONA-04 | Session uses active persona's character/style/voice + speaks greeting; persona prompt injected with CRM/preference context via existing sanitization | Audio-only scope constraint (Common Pitfalls §3 — headline risk), `voice_map`-resolution precedent (`public_avatar.py` webrtc/session handler), single-string `developer`-role injection contract (`agent_chat_service.stream_agent_response`), two-gate sanitizer reuse (`personalization_sanitizer.py`) |
| LAND-01 | Regular user → `/` post-login; admin → `/admin/dashboard`; update `routing.spec.ts` | Exact 2-line diff identified: `login.tsx` line 36, `auth-guard.tsx` line 29 (Code Examples §4); `routing.spec.ts` 3-assertion triage (Common Pitfalls §4) |

</phase_requirements>

## Standard Stack

This phase adds no new third-party dependencies. It exclusively reuses the existing stack:

### Core
| Library | Version | Purpose | Why Standard (this repo) |
|---------|---------|---------|--------------|
| SQLAlchemy 2.0 (async) + Alembic | pinned per `backend/pyproject.toml` | `AvatarPersona` ORM model + migration | Every existing table uses this; no alternative considered |
| Pydantic v2 | pinned | `AvatarPersona*` schemas | Repo-wide convention |
| FastAPI | pinned | `/api/v1/personas` + `/admin/personas` routers | Repo-wide convention |
| React 18 + TanStack Query v5 | pinned | Persona-switcher UI + admin catalog UI | Repo-wide convention |
| react-i18next | pinned | 5-locale persona UI copy | Repo-wide convention, locale-parity test is mandatory gate |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| azure-ai-voicelive | `1.3.0b1` (verified installed, exact pin `==1.3.0b1` in `backend/pyproject.toml:57`) | `AvatarConfig`/voice session negotiation | Already in use in `voice_live_websocket.py`; Phase 36 does **not** need to touch this SDK directly — it only needs to resolve `voice_name` strings that flow into the existing `create_public_webrtc_session_config`/`create_webrtc_session_config` calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multi-row `UserPreference` category `selected_persona_id` (D-04 literal reading) | New dedicated `user_id`-unique column/table for persona selection | D-04 explicitly says "no new user-level table"; multi-row table requires an upsert-by-category helper (see Common Pitfalls §2) — accept the friction, don't relitigate D-04 |
| JSON `Text` column for persona per-locale voice map | Separate `persona_voice_map` relational table (locale, voice, persona_id) | Both are "Claude's Discretion" per 36-CONTEXT.md. Recommend JSON-Text column: exact precedent already merged (`PublicKnowledgeConfig.voice_map`), same `parse_voice_map`-style helper reusable, avoids a 5th migration-managed table for a bounded 5-locale map |

**Installation:** No new packages. Verify existing pin only:
```bash
cd backend && pip show azure-ai-voicelive  # expect 1.3.0b1
```

**Version verification:** `azure-ai-voicelive` latest PyPI release is `1.3.0b1` (checked 2026-08-02 via `pypi.org/pypi/azure-ai-voicelive/json`) — this matches the exact pin already in `backend/pyproject.toml:57` (`azure-ai-voicelive[aiohttp]==1.3.0b1`). No upgrade available or needed. `[VERIFIED: PyPI registry]`

## Architecture Patterns

### Recommended Project Structure (new files only; everything else is edits to existing files)
```
backend/app/
├── models/
│   └── avatar_persona.py          # NEW: AvatarPersona ORM model
├── schemas/
│   └── avatar_persona.py          # NEW: AvatarPersonaCreate/Update/Out, VoiceMap sub-schema
├── services/
│   └── avatar_persona_service.py  # NEW: CRUD + unique-default guard + resolve_active_persona()
├── api/
│   ├── admin_avatar_personas.py   # NEW: admin CRUD router (mirrors admin_public_knowledge_config.py)
│   └── avatar_personas.py         # NEW: GET /api/v1/personas (enabled-only, public-safe fields)
└── alembic/versions/
    └── {next_letter}_avatar_persona_table.py  # NEW migration, down_revision = current head

frontend/src/
├── api/
│   └── avatar-personas.ts         # NEW: typed client (mirrors user-preferences.ts / voice-live.ts)
├── hooks/
│   ├── use-avatar-personas.ts     # NEW: list/CRUD hooks (mirrors use-avatar-characters.ts)
│   └── use-selected-persona.ts    # NEW: read/switch active persona (mirrors use-user-preferences.ts)
├── components/
│   ├── admin/persona-dialog.tsx   # NEW: admin CRUD dialog (mirrors user-personalization-dialog.tsx)
│   └── persona-switcher.tsx       # NEW: in-page switch entry on avatar-page.tsx (placement per UI-SPEC)
└── pages/
    └── avatar-page.tsx            # EDIT: mount persona-switcher near existing user-badge header area
```

### Pattern 1: Singleton-map admin config → generalize to multi-row default-flagged catalog
**What:** `PublicKnowledgeConfig.voice_map` is a *singleton* row's JSON column. `AvatarPersona` is a *multi-row* table where each row optionally carries its own JSON voice-map column, plus an `is_default: bool` that must be unique-true across enabled rows.
**When to use:** Any admin-managed catalog with a "exactly one default" invariant.
**Example (service-layer guard — no existing precedent in repo, must be written new, but follows the transactional-guard style already used elsewhere, e.g. `get_owned_session`'s 404-for-all-failure-modes pattern):**
```python
# backend/app/services/avatar_persona_service.py
# Source: pattern synthesized from admin_public_knowledge_config.py (singleton
# config swap) + user_preference dual-filter IDOR guard style (admin_user_preferences.py)
async def set_default_persona(db: AsyncSession, persona_id: str) -> AvatarPersona:
    target = await db.get(AvatarPersona, persona_id)
    if target is None or not target.enabled:
        bad_request("Cannot set a missing or disabled persona as default")
    # Single UPDATE clears all other defaults, then sets the target -- one
    # transaction, no read-then-write race window under SQLite/Postgres
    # (both support this statement form via SQLAlchemy Core update()).
    await db.execute(update(AvatarPersona).values(is_default=False))
    target.is_default = True
    await db.commit()
    await db.refresh(target)
    return target
```
**Guard on disable/delete of the current default:** before `enabled=False` or `DELETE`, check `persona.is_default`; if true, require the request to include a `new_default_persona_id` (mirrors `PersonalizationSummary`'s "explicit, not implicit" style) or reject with 409 (`ConflictException`) — **never silently leave zero defaults** (violates D-02/D-06's "anonymous path never falls back to nothing" guarantee).

### Pattern 2: Multi-row preference table used as a single-valued slot (`selected_persona_id`)
**What:** `UserPreference(user_id, category, value)` allows multiple rows per `(user_id, category)` pair by design (see model docstring). Storing `selected_persona_id` needs upsert semantics: delete-then-insert or update-existing-else-insert, inside one transaction.
**When to use:** D-04's literal instruction ("no new user-level table").
**Example:**
```python
# backend/app/services/avatar_persona_service.py
# Source: pattern synthesized -- no direct precedent; UserPreference model at
# backend/app/models/user_preference.py explicitly allows multiple rows per category
async def set_selected_persona(db: AsyncSession, user_id: str, persona_id: str) -> None:
    existing = await db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == user_id,
            UserPreference.category == "selected_persona_id",
        )
    )
    if existing:
        existing.value = persona_id
    else:
        db.add(UserPreference(user_id=user_id, category="selected_persona_id", value=persona_id))
    await db.commit()
```
**Frontend-side exclusion:** add `"selected_persona_id"` to the backend `PreferenceCategory` Literal (`backend/app/schemas/user_preference.py`) and the frontend mirror (`frontend/src/api/user-preferences.ts`), but **exclude it from `CATEGORY_OPTIONS`** in `frontend/src/hooks/use-user-preferences.ts` — it must not appear as a manually-typable free-text tag in the generic admin "add preference" dropdown; it's system-written only, via the dedicated persona-switch endpoint. Admin sees it read-only in the existing `PersonalizationSummary` preferences list.

### Pattern 3: Character/style cascading select (admin persona form)
**What:** `vl-instance-dialog.tsx` builds a flat grid of `{characterId, style}` combinations from `AVATAR_CHARACTERS`, filtered by a `video`/`photo`/`all` toggle, with thumbnail fallback-to-initials on image-load failure.
**When to use:** Persona admin form's character+style picker — clone this exact grid component rather than building a two-step `<Select>` cascade from scratch.
**Example:**
```tsx
// Source: frontend/src/components/admin/vl-instance-dialog.tsx:118-150 (existing, verified in this session)
const filteredAvatarItems = useMemo(() => {
  const items: AvatarGridItem[] = [];
  for (const c of AVATAR_CHARACTERS) {
    if (c.isPhotoAvatar) { /* photo: no style */ }
    else { for (const s of c.styles) { /* video: one item per style */ } }
  }
  return items;
}, [avatarFilter]);
```
Reuse `AVATAR_CHARACTERS` from `frontend/src/data/avatar-characters.ts` directly (D-03 explicitly names this precedent).

### Pattern 4: Voice-name resolution priority chain (D-07)
**What:** Persona's own per-locale voice map (if set for the current locale) > Phase 34 admin `voice_map` (`PublicKnowledgeConfig.voice_map`) > `DEFAULT_PUBLIC_VOICE_BY_LOCALE` hardcoded fallback.
**Example:**
```python
# Source: pattern extends backend/app/api/public_avatar.py's existing
# `voice_map.get(body.locale, "")` line + backend/app/services/voice_live_webrtc.py's
# DEFAULT_PUBLIC_VOICE_BY_LOCALE constant (both verified this session)
def resolve_voice_for_locale(persona: AvatarPersona, public_voice_map: dict[str, str], locale: str) -> str:
    persona_map = parse_persona_voice_map(persona)  # same json.loads-with-fallback style as parse_voice_map()
    return (
        persona_map.get(locale)
        or public_voice_map.get(locale)
        or DEFAULT_PUBLIC_VOICE_BY_LOCALE.get(locale, DEFAULT_PUBLIC_VOICE_BY_LOCALE["en-US"])
    )
```

### Pattern 5: Post-login redirect (LAND-01) — exact diff, not a pattern to design
```tsx
// frontend/src/pages/login.tsx:36 -- BEFORE
navigate("/user/dashboard");
// AFTER
navigate("/");

// frontend/src/router/auth-guard.tsx:29 (GuestRoute) -- BEFORE
const target = user?.role === "admin" ? "/admin/dashboard" : "/user/dashboard";
// AFTER
const target = user?.role === "admin" ? "/admin/dashboard" : "/";
```
No router-tree change needed — `/` is already mounted outside both `ProtectedRoute` and `GuestRoute`/`AdminRoute` in `frontend/src/router/index.tsx` (verified: comment explicitly states "this route must not sit behind either guard"). LAND-01 is purely a redirect-target change, not a routing/guarding change.

### Anti-Patterns to Avoid
- **Building a second "avatar-persona" WebSocket/video pipeline to literally satisfy PERSONA-04's "character/style" wording:** the existing `/` page is audio-only end-to-end (see Common Pitfalls §3). Store character/style on the model for admin-facing completeness and future-proofing, resolve `voice` into the real session, but do not attempt video wiring in this phase — it is a different, much larger architecture (the WS-based `voice_live_websocket.py` + `use-voice-live.ts` + `use-avatar-stream.ts` pipeline, currently only used by legacy coach/training flows) that 36-CONTEXT.md's Deferred Ideas / Claude's Discretion sections do not authorize opening.
- **Treating `selected_persona_id` as safe for a plain `INSERT`:** will silently create duplicate rows across repeated switches (see Common Pitfalls §2) unless the upsert pattern above is used.
- **Letting `is_default` toggling leave zero or multiple defaults transiently visible to a concurrent anonymous request:** always wrap the "clear all, set one" pair in a single `await db.execute(update(...))` + `commit()`, never two separate commits.
- **Adding new i18n keys without running the locale-parity + whitelist-cap tests first:** the whitelist is hard-capped at 15/15 (`frontend/src/i18n/untranslated-whitelist.ts` — verified exact count and cap assertion this session: `expect(UNTRANSLATED_WHITELIST.length).toBeLessThanOrEqual(15)`); any new persona-admin/persona-switcher UI text must get real es-ES/es-MX/es-US translations, not whitelist entries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-locale voice fallback resolution | New locale-fallback utility | Extend `parse_voice_map()` style (`public_knowledge_config_service.py`) + reuse `DEFAULT_PUBLIC_VOICE_BY_LOCALE` constant | Exact same 5-locale set, already battle-tested with malformed-JSON try/except |
| Prompt-injection sanitization for persona prompt fragment | New sanitizer | `sanitize_field`/`sanitize_free_text_with_pii` from `personalization_sanitizer.py` | D-08 explicitly mandates reuse; two-gate design (import-time + chat-time) already proven for PERS-01/02 |
| IDOR protection on persona-switch endpoint | Custom ownership check | Dual-filter pattern (`WHERE id = X AND ...`) already used in `admin_user_preferences.py` PUT/DELETE handlers — though persona-switch is simpler (no `user_id` filter needed on the persona table itself, only on the `UserPreference` row) | Established codebase idiom for "can this user touch this row" |
| Character/style picker UI | New two-step cascading `<Select>` | Clone `vl-instance-dialog.tsx`'s flat filterable grid (`filteredAvatarItems` + thumbnail-fallback) | Already handles photo-vs-video-avatar branching, CDN thumbnail 404 fallback, filter toggle |
| Enabled-only public persona list endpoint | New filtering logic | `WHERE enabled = true` filter mirroring `/api/v1/personas`'s stated D-01 contract, same shape as any existing "public subset of admin resource" endpoint (no direct precedent found, but the shape is standard REST — don't over-engineer) | — |

**Key insight:** Nothing in this phase requires new infrastructure. The single genuinely new piece of logic is the unique-default transactional guard (Pattern 1) — everything else is copy-adapt from a directly analogous existing file.

## Common Pitfalls

### Pitfall 1: Assuming PERSONA-04 requires video avatar rendering
**What goes wrong:** A plan that adds tasks to wire `AvatarConfig(character=..., style=...)` into `create_public_webrtc_session_config`/`create_webrtc_session_config` will fail, because those functions build `session_config` dicts that architecturally have no `avatar` key — confirmed by reading `voice_live_webrtc.py` in full (both `create_webrtc_session_config` and `create_public_webrtc_session_config` only set `voice`/`turn_detection`/`input_audio_noise_reduction`/`input_audio_echo_cancellation`). Both paths return `avatar_warning=AVATAR_WARNING` ("Avatar (digital human) is not supported with WebRTC audio transport in preview.").
**Why it happens:** True video-avatar negotiation only happens over the separate WS-based `voice_live_websocket.py` (`session.avatar.connect` message type, `AvatarConfig` object, ICE/SDP-over-WS) used exclusively by legacy coach/training sessions — a fully separate pipeline from `avatar-page.tsx`'s `useAnonymousVoiceLive`/`useVoiceLiveWebrtc` hooks, which hardcode `avatarEnabled: false` and never negotiate a video `MediaStreamTrack` (`pc.ontrack` only branches on `"audio"` kind in both hooks).
**How to avoid:** Scope PERSONA-04 to: (a) store character+style on `AvatarPersona` for admin completeness/future-proofing, (b) resolve and apply **voice** into the real session (this DOES work end-to-end today), (c) speak the greeting via the existing TTS/voice pipeline post-connect. Do NOT add tasks to make `AvatarView` in `avatar-page.tsx` render actual video frames — `isDigitalHumanMode={false}` stays as-is.
**Warning signs:** Any plan task mentioning "wire avatar video into the `/` avatar page" or "connect `AvatarConfig` in `public_avatar.py`."

### Pitfall 2: `UserPreference.category="selected_persona_id"` duplicate-row bug
**What goes wrong:** A naive `db.add(UserPreference(...))` on every persona switch creates a new row each time (model explicitly permits multiple rows per category), so `PersonalizationSummary`'s preference list grows unboundedly and "the user's current persona" becomes ambiguous (which row is authoritative — latest by `created_at`? First match?).
**Why it happens:** `UserPreference`'s docstring/design intentionally supports multi-valued categories like `focus_area`; `selected_persona_id` is the first category in the app that needs single-valued semantics.
**How to avoid:** Use the upsert-by-category helper in Pattern 2 (query-existing-then-update-or-insert, one query + one write, inside one transaction). Add a `UNIQUE(user_id, category)` partial constraint ONLY if the team is comfortable with a migration that also needs to guard existing multi-valued categories (`focus_area`, etc.) from breaking — likely safer to enforce uniqueness in the service layer only, not the DB schema, to avoid a destructive migration on existing data.
**Warning signs:** `admin_user_preferences.py`'s `GET /{user_id}/personalization` response showing 3+ `selected_persona_id` entries for one user.

### Pitfall 3: Stale/incomplete `AVATAR_VIDEO_CHARACTERS` constant vs. current Azure docs
**What goes wrong:** Seeding the default persona or building the admin picker exclusively from the in-repo constant silently omits 4 avatars now listed on Microsoft's official "Supported standard text to speech avatar" page (checked 2026-08-02): **Rowan, Celine, Nia, Malik** (all styled "N/A" — no sub-styles) — and doesn't warn admins that **Jeff retires starting December 2026** (explicit notice on the same page).
**Why it happens:** `backend/app/services/avatar_characters.py` was last updated in an earlier phase (12/16-era) and has not been resynced against Microsoft's evolving standard-avatar catalog.
**How to avoid:** This phase should NOT expand `AVATAR_VIDEO_CHARACTERS` unless explicitly requested (D-03 says "reuse the existing constant precedent" — the existing list is what's authoritative for this codebase's scope). Flag the Jeff-retirement notice as a Common Pitfall for whoever picks the **seed default persona** (Claude's Discretion item) — avoid seeding the system default onto an avatar with a known Dec-2026 retirement date if the persona catalog is meant to outlive that date. `[CITED: learn.microsoft.com/.../standard-avatars, checked 2026-08-02]`
**Warning signs:** None at build time — this is a data/business risk, not a code bug. Document it in the plan as an explicit call-out for the human reviewing seed choices.

### Pitfall 4: Blanket-updating all 3 `routing.spec.ts` `/user/dashboard` assertions
**What goes wrong:** D-09 authorizes updating the `GuestRoute` redirect-target assertion (line 30, `"authenticated user on /login is redirected to dashboard"`). It does NOT explicitly authorize changing the direct-URL-navigation assertion (line 41, `"logout redirects back to login"` — first assertion navigates directly to `/user/dashboard` while still logged in, unrelated to post-login landing) or the `AdminRoute` non-admin-redirect assertion (line 36, `"regular user cannot access admin routes"`).
**Why it happens:** All three assertions share the same regex (`toHaveURL(/\/user\/dashboard/)`), making a naive find-replace change all three.
**How to avoid:**
- Line 30 (GuestRoute test): **change** to `toHaveURL(/^http:\/\/localhost:\d+\/$/)` or equivalent `/`-matching assertion (D-09 mandate).
- Line 41 (logout test, direct navigation while authenticated): **do not change** — `/user/dashboard` remains directly reachable per D-10.
- Line 36 (AdminRoute non-admin-redirect test): **flag as an open question for the planner/user**, not a unilateral change — 36-CONTEXT.md doesn't name `AdminRoute`'s redirect target explicitly. Recommend leaving `AdminRoute`'s fallback as `/user/dashboard` (unauthorized-access redirect is a different concern than post-login landing) unless the user confirms otherwise during planning.
**Warning signs:** A single sed/find-replace across the whole file instead of 3 reviewed, individually-justified edits.

### Pitfall 5: Anonymous path accepting a client-supplied `persona_id`
**What goes wrong:** If `/public/avatar/session` or `/public/avatar/chat` is extended to accept a `persona_id` query/body param without validating `enabled=True`, a client could reference a disabled or admin-only-draft persona (potential prompt-fragment content leak or unintended-default bypass).
**Why it happens:** Natural to add a `persona_id` param mirroring the login path's persona resolution, forgetting the anonymous-path whitelist constraint explicitly called out in 36-CONTEXT.md's Integration Points ("匿名端点不得接受 client 指定的任意 persona 之外的注入面（persona_id 白名单校验：必须是 enabled persona）").
**How to avoid:** Anonymous path should resolve the persona server-side ONLY as "the current admin-marked default" (D-06) — never accept a client-supplied persona identifier at all on the anonymous endpoints. Persona switching (client-initiated `persona_id`) is a **logged-in-only** feature per D-03/D-05/D-06's combined reading.
**Warning signs:** A `persona_id: str | None` field added to `PublicChatRequest`/`PublicSessionRequest` schemas.

## Code Examples

### AvatarConfig field contract (verified via installed SDK, for future video-wiring reference only — not required by this phase's scope)
```python
# Source: introspected directly from installed azure-ai-voicelive==1.3.0b1
# (azure.ai.voicelive.models.AvatarConfig docstring, verified this session)
class AvatarConfig:
    avatar_type: str  # "video-avatar" | "photo-avatar"
    character: str    # Required
    style: str | None
    model: str | None       # Required for photo avatar: "vasa-1"
    customized: bool        # Required
    video: VideoParams | None
    scene: Scene | None
    output_protocol: str    # "webrtc" | "websocket", default "webrtc"
    output_audit_audio: bool
```
`[VERIFIED: installed package introspection, azure-ai-voicelive==1.3.0b1]`

### Existing voice-map resolution precedent (to extend, not replace)
```python
# backend/app/api/public_avatar.py -- existing webrtc/session handler
# Source: verified this session, exact current code
public_config = await get_active_public_config(db)
voice_map = parse_voice_map(public_config)
voice = voice_map.get(body.locale, "")
return await create_public_webrtc_session_config(
    db, agent_id=public_config.agent_id, voice_name=voice, locale=body.locale
)
```

### Single-string developer-role injection contract (must concatenate, not pass multiple params)
```python
# backend/app/services/agent_chat_service.py -- exact signature, verified this session
async def stream_agent_response(
    db, agent_name, agent_version, message, previous_response_id,
    personalization_context: str | None = None,  # single string; persona fragment
                                                    # + CRM/preference context must be
                                                    # concatenated BEFORE this call
):
    if personalization_context:
        input_items.append({"role": "developer", "content": personalization_context})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — no persona concept existed before this phase | `AvatarPersona` entity introduces the first "system-managed, admin-curated, user-switchable" catalog pattern in this codebase | Phase 36 (this phase) | Establishes the precedent other future catalogs (e.g. skill packs) may follow |

**Deprecated/outdated:**
- `Jeff` standard avatar: Microsoft has announced retirement starting December 2026 per current docs — not yet removed from `AVATAR_VIDEO_CHARACTERS`, and this phase should not select it as the seeded system default. `[CITED: learn.microsoft.com/.../standard-avatars, checked 2026-08-02]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `AdminRoute` non-admin-redirect target (`/user/dashboard`) should stay unchanged, since D-09/D-10 only name the post-login landing redirect, not the unauthorized-access redirect | Common Pitfalls §4, Architecture Patterns §5 | If wrong, `routing.spec.ts:36` needs updating too, and `AdminRoute`'s fallback should become `/`; low risk either way since it's a 1-line change, but should be confirmed before locking the plan |
| A2 | JSON-`Text`-column is preferred over a relational per-locale table for persona voice maps | Standard Stack, Alternatives Considered | Low risk — both are "Claude's Discretion" per 36-CONTEXT.md; if the planner disagrees, the alternative is a small additional migration/model, not a redesign |
| A3 | Enforcing `selected_persona_id` single-valuedness at the service layer (not a DB unique constraint) is acceptable | Common Pitfalls §2 | Low risk for POC scale; if concurrent double-switch requests ever race, a duplicate row could theoretically appear — acceptable given no concurrent-switch scenario is realistic for a single logged-in user in one browser tab |

## Open Questions

1. **Should `AdminRoute`'s non-admin fallback target also change from `/user/dashboard` to `/`?**
   - What we know: D-09 explicitly names the `GuestRoute` post-login redirect and the `routing.spec.ts` assertion for it. D-10 says legacy coach routes stay directly accessible.
   - What's unclear: Whether "a regular user hitting an admin-only route" should bounce to the new landing page (`/`) for UX consistency, or stay bouncing to `/user/dashboard` (a still-valid, still-accessible legacy route) since that's a different concern (unauthorized access, not post-login landing).
   - Recommendation: Default to NOT changing it (leave `AdminRoute` fallback as `/user/dashboard`, leave `routing.spec.ts:36` unchanged) unless the user confirms otherwise during plan review — this is the more conservative, less-scope-creepy reading of the locked decisions.

2. **Exact placement/component style of the in-page persona-switcher entry (D-05 explicitly defers this to UI-SPEC).**
   - What we know: `avatar-page.tsx`'s header already has a natural insertion point (the `user.email` + "专属模式" `Badge` area, logged-in-only, lines 258-278).
   - What's unclear: Dropdown vs. side-panel vs. dialog — 36-CONTEXT.md explicitly marks this as Claude's Discretion / UI-SPEC's job, not research's job.
   - Recommendation: Defer to the UI-SPEC phase; this research only confirms the insertion point exists and is logged-in-gated already.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| azure-ai-voicelive (Python SDK) | PERSONA-04 voice resolution (indirect, via existing `voice_live_webrtc.py`) | ✓ | 1.3.0b1 (verified installed + PyPI latest match) | — |
| Azure Speech standard-avatar catalog (external service, docs-only dependency) | PERSONA-01 character/style constant accuracy | ✓ (docs reachable) | Catalog checked 2026-08-02, docs dated ms.date 2025-11-05 / updated_at 2026-06-05 | In-repo static constant already exists as the source of truth per D-03; no live API call needed at runtime |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — this phase has no blocking external dependency; the Azure avatar catalog is consumed as a static, already-vendored constant list, not a live API call.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | pytest 8.3+ / pytest-asyncio (auto mode), `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Backend config | `backend/pyproject.toml` (`testpaths=["tests"]`, `--cov=app --cov-fail-under=89`, `timeout=60`) |
| Frontend unit Framework | Vitest, `frontend/package.json` (`"test": "vitest run"`) |
| Frontend E2E Framework | Playwright, `frontend/e2e/playwright.config.ts`, run via `npm run test:e2e` (`--config=e2e/playwright.config.ts`) |
| Quick run command (backend) | `cd backend && pytest -v tests/test_avatar_persona_service.py -m "not integration"` |
| Quick run command (frontend) | `cd frontend && npx vitest run src/hooks/use-avatar-personas.test.ts` |
| Full suite command (backend) | `cd backend && pytest -v -m "not integration"` |
| Full suite command (frontend) | `cd frontend && npm run test && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERSONA-01 | Admin CRUD persona (create/edit/enable/disable) | unit + E2E | `pytest tests/test_admin_avatar_personas_api.py -x` / `playwright test admin-avatar-personas.spec.ts` | ❌ Wave 0 |
| PERSONA-02 | Unique-default guard (set/clear/reject-invalid) | unit | `pytest tests/test_avatar_persona_service.py::test_set_default_clears_others -x` | ❌ Wave 0 |
| PERSONA-03 | Logged-in switch persists `selected_persona_id`, rebuild session | unit + E2E | `pytest tests/test_avatar_persona_service.py::test_set_selected_persona_upsert -x` / `playwright test personalized-persona-switch.spec.ts` | ❌ Wave 0 |
| PERSONA-04 | Session voice/greeting resolves from active persona; prompt fragment injected+sanitized | unit | `pytest tests/test_personalized_avatar_service.py::test_persona_fragment_injected -x` (extend existing file) | Partial (file exists, test case doesn't) |
| LAND-01 | Post-login redirect target; `routing.spec.ts` assertions | E2E | `playwright test routing.spec.ts` | ✅ (existing file, needs 1 assertion updated per Pitfall 4) |

### Sampling Rate
- **Per task commit:** backend quick run + frontend quick run (whichever module was touched)
- **Per wave merge:** `pytest -v -m "not integration"` (backend full) + `npm run test` (frontend unit full)
- **Phase gate:** Full suite green (backend full + frontend unit full + `npm run test:e2e`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_avatar_persona_service.py` — covers PERSONA-02, PERSONA-03 service-layer logic (unique-default guard, upsert-by-category)
- [ ] `backend/tests/test_admin_avatar_personas_api.py` — covers PERSONA-01 admin CRUD endpoints
- [ ] `backend/tests/test_avatar_personas_api.py` — covers PERSONA-01's public `GET /api/v1/personas` (enabled-only filter, no leaking disabled personas)
- [ ] `frontend/src/hooks/use-avatar-personas.test.ts` + `use-selected-persona.test.ts` — hook-level coverage
- [ ] `frontend/e2e/admin-avatar-personas.spec.ts` — admin CRUD + default-toggle E2E
- [ ] `frontend/e2e/personalized-persona-switch.spec.ts` — logged-in switch + persistence-across-relogin E2E
- [ ] Extend `frontend/e2e/routing.spec.ts` — update line 30 assertion per D-09; leave lines 36/41 per Pitfall 4/Open Question 1
- [ ] Extend `backend/tests/test_personalized_avatar_service.py` and `backend/tests/test_avatar_service.py` (anonymous path) — persona-prompt-fragment injection + sanitization coverage for PERSONA-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (persona-switch endpoint) | Existing JWT Bearer dependency (`get_current_user`), no new auth mechanism |
| V3 Session Management | no (new surface) | N/A — reuses existing `personalized_session_service.py` session lifecycle unchanged |
| V4 Access Control | yes | Admin CRUD gated via existing `require_role("admin")` dependency; persona-switch gated via `get_current_user` + IDOR dual-filter pattern on the `UserPreference` row (Common Pitfalls §2) |
| V5 Input Validation | yes | Pydantic v2 schemas for all new request bodies; `character`/`style` validated against the static `AVATAR_VIDEO_CHARACTERS`/`AVATAR_CHARACTERS` allowlist (never free-text), mirroring existing `validate_avatar_style`-style validation referenced in `voice_live_websocket.py` |
| V6 Cryptography | no | No new secrets/crypto surface introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous client supplying arbitrary `persona_id` to reach a disabled/draft persona's prompt fragment | Elevation of Privilege / Information Disclosure | Anonymous endpoints resolve persona server-side only (current admin-marked default) — never accept a client-supplied persona identifier at all (Common Pitfalls §5) |
| IDOR on persona-switch (`UserPreference` row) | Tampering | Dual-filter `WHERE user_id = current_user.id` on every read/write of the `selected_persona_id` row (same idiom as `admin_user_preferences.py`'s PUT/DELETE) |
| Prompt injection via free-text persona "greeting"/"prompt fragment" admin field | Tampering (of LLM behavior) | Route persona prompt fragment through the existing two-gate `personalization_sanitizer.py` (`sanitize_field`/`sanitize_free_text_with_pii`) at both admin-save time and chat-injection time, per D-08 |
| Race on `is_default` toggle exposing zero-default window to a concurrent anonymous request | Denial of Service (soft — anonymous path would need a fallback-of-fallback) | Single-transaction "clear all, set one" `UPDATE` (Pattern 1) — never two separate commits |

## Sources

### Primary (HIGH confidence)
- `backend/app/models/user_preference.py`, `backend/app/schemas/user_preference.py`, `backend/app/api/admin_user_preferences.py` — read in full this session
- `backend/app/services/personalization_injection_service.py`, `personalized_avatar_service.py`, `personalized_session_service.py`, `agent_chat_service.py` (grepped signature) — read/verified this session
- `backend/app/api/personalized_avatar.py`, `public_avatar.py`, `admin_public_knowledge_config.py` — read in full this session
- `backend/app/services/voice_live_webrtc.py` (320 lines, full read), `avatar_characters.py` (full read across two passes) — this session
- `frontend/src/pages/avatar-page.tsx`, `login.tsx`, `router/auth-guard.tsx`, `router/index.tsx`, `e2e/routing.spec.ts` — read in full this session
- `frontend/src/hooks/use-anonymous-voice-live.ts`, `use-voice-live-webrtc.ts` — read in full this session (638 + 661 lines)
- `frontend/src/data/avatar-characters.ts`, `frontend/src/components/admin/vl-instance-dialog.tsx` (relevant sections), `frontend/src/hooks/use-avatar-characters.ts` — read this session
- `frontend/src/i18n/locale-parity.test.ts`, `untranslated-whitelist.ts` — read in full this session
- Installed package introspection: `python3 -c "import azure.ai.voicelive.models as m; ..."` against the actual project venv (`azure-ai-voicelive==1.3.0b1` confirmed via `pip show`) `[VERIFIED: local environment introspection]`
- `docs/voice-live-avatar/06-webrtc-avatar.md` — read in full this session (true video-avatar architecture documentation)
- `backend/alembic/versions/` directory + `python -m alembic heads`/`history` command output — this session (confirmed current migration head: `d37a_user_preference_table`)

### Secondary (MEDIUM confidence)
- `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars` — fetched 2026-08-02, `ms.date: 2025-11-05`, `updated_at: 2026-06-05` — full character/style table cross-checked against `avatar_characters.py` `[CITED]`
- `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar` — fetched 2026-08-02, `ms.date: 2026-05-21` `[CITED]`
- PyPI registry JSON (`pypi.org/pypi/azure-ai-voicelive/json`) — fetched 2026-08-02, confirms `1.3.0b1` is the latest release, matching the repo's exact pin `[VERIFIED: npm/pypi registry]`

### Tertiary (LOW confidence)
- None — all findings in this document were either verified via direct file/environment inspection or cited from official Microsoft Learn pages fetched this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, exact versions verified via installed-package introspection and PyPI registry
- Architecture: HIGH — every pattern traced to a specific existing file, read in full this session, with exact line numbers where load-bearing
- Pitfalls: HIGH (architectural gap, data-model friction, test-assertion triage — all independently verified by reading source) / MEDIUM (Azure avatar-catalog staleness — verified against current docs but the "should we care about Jeff retirement for seeding" judgment call is a business decision, not a technical fact)

**Research date:** 2026-08-02
**Valid until:** 30 days for the in-repo architectural findings (stable, code doesn't change on its own); 7 days is overly conservative for the Azure avatar-catalog citation since Microsoft's own `ms.update-cycle` metadata on that page states 180-days — treat the character/style list as valid through at least early 2027 baseffective the ms.date on the page, but re-check before seeding data if this phase's execution slips past several weeks.
