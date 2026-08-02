# Phase 36: Avatar Persona Selection & Post-Login Landing - Context

**Gathered:** 2026-08-02 (decisions approved interactively by user in-session)
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Admins manage a catalog of digital-human personas (Azure Voice Live prebuilt avatar character+style, per-language voice, greeting/persona prompt fragment, enabled flag, exactly one default). Logged-in users can switch persona from an in-page entry on the avatar page; the choice persists as `selected_persona_id` and is active on next login. Anonymous visitors and users without a saved choice get the admin-marked default persona automatically — there is NO forced selection page. After login, regular users land directly on the avatar page (`/`) with personalized memory (PERS-02 chat-time injection) and their remembered persona; admins still land on `/admin/dashboard`.

Out of scope: Custom Avatar training (Azure standard/prebuilt avatars only — Lisa, Harry, Meg, Max etc. + styles), automatic preference extraction (PERS-04), real CRM integration (PERS-05), deleting coach code (CLEAN-01).

</domain>

<decisions>
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

</decisions>

<specifics>
## Specific Ideas

- 遵循 CLAUDE.md 最高优先级流程：逐需求实现，每需求 100% 单测 + Playwright E2E 全过后独立 commit + push
- 用户全程离线授权：自主完成 research → ui-spec → plan → execute → review → verify，各阶段依次 commit & push
- 需求实现顺序建议：PERSONA-01/02（后端实体+admin CRUD）→ PERSONA-04（会话应用）→ PERSONA-03（用户切换+持久化）→ LAND-01（登录落地）

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 33 用户偏好存储 + admin 偏好打标签 UI + chat-time system prompt 注入（含 sanitization 双闸）— `selected_persona_id` 与 persona prompt 片段的挂载点
- Phase 34 voice_map：admin GET/PUT singleton-config API + `DEFAULT_PUBLIC_VOICE_BY_LOCALE` 回退 — persona per-language voice 的先例与回退层
- Phase 32 匿名路径：avatar-page.tsx、anonymous session/chat 端点、WebRTC ephemeral-credential 端点、useAnonymousVoiceLive hook
- Phase 12 `AVATAR_VIDEO_CHARACTERS` 常量（character→styles 映射）— persona 表单的 character/style 选择器数据源
- Phase 29 双路径架构：voice/avatar 配置解析集中于会话凭据端点 — persona 解析应插在同一层
- `frontend/src/pages/login.tsx` + `GuestRoute` — LAND-01 重定向修改点
- 既有 admin CRUD 页面模式（Table + Dialog，Phase 11 先例）

### Integration Points / Hard Constraints
- `routing.spec.ts` 的无守卫 `toHaveURL(/\/user\/dashboard/)` 断言 — LAND-01 要求**有意更新**该断言（非回归破坏）
- `voice-live-proxy.spec.ts:489` admin "Voice Live" 可见性断言 — AdminLayout 新增 persona 入口时不得破坏
- locale-parity 测试自动枚举 namespace — 新增 i18n key 必须 5 locale 齐全
- 匿名端点不得接受 client 指定的任意 persona 之外的注入面（persona_id 白名单校验：必须是 enabled persona）

</code_context>

<deferred>
## Deferred Ideas

- Custom Avatar（训练自有形象）— 成本高，POC 不做
- Persona 级知识库绑定（不同 persona 不同知识源）— 未提出，暂不做
- 自动偏好抽取（PERS-04）、真实 CRM（PERS-05）、删除 coach 代码（CLEAN-01）— 维持 future

</deferred>

---

*Phase: 36-avatar-persona-selection-post-login-landing*
*Context gathered: 2026-08-02*
