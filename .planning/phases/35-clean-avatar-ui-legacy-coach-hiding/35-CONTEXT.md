# Phase 35: Clean Avatar UI & Legacy Coach Hiding - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The avatar experience presents a decluttered UI (digital human + document-links panel only, voice content and document sources visually separate — AVUI-01), and all legacy coach navigation entries in the end-user app nav are hidden behind a feature flag while code and routes remain intact and existing tests keep passing (AVUI-02). AVUI-01 is largely satisfied by Phase 32/33's standalone `avatar-page.tsx`; this phase verifies/polishes and locks it in with an explicit chrome-absence E2E assertion. AVUI-02 reuses the existing 4-layer feature-flag pipeline. Deleting coach code (CLEAN-01) is a future milestone, not this phase.

</domain>

<decisions>
## Implementation Decisions

### AVUI-02 范围与机制
- **D-01: UserLayout-only 导航门控** — 仅隐藏 `UserLayout` 顶部导航的 4 个 coach 项（dashboard/training/history/reports，桌面 `<nav>` 与移动 Sheet 两处渲染点同时门控）；**不动 `AdminLayout` 侧边栏**（`voice-live-proxy.spec.ts:489` 有无守卫的 "Voice Live" 可见性断言，且需求受众为 end user，admin 侧边栏留给 CLEAN-01）
- **D-02: 复用既有 4 层 flag 管道，env-var-only** — 新增 `Settings.feature_legacy_coach_nav_enabled: bool = False`（默认隐藏）→ `GET /api/v1/config/features` 的 `FeatureFlags.legacy_coach_nav_enabled` → `useFeatureFlags()` → `ConfigContext.defaultFlags`（默认 false）+ `useConfig()` 消费；参照 `feature_conference_enabled` 先例，**无 DB 覆盖、无 admin UI 开关**（POC 阶段 env 翻转足够，避免新增 5 locale i18n 面）
- **D-03: 代码与路由全保留** — 不删任何 coach 页面/路由/后端 API；直接 URL 访问 `/user/training` 等仍可达（flag 仅是 UI 可见性，不是访问控制边界，真实边界仍是 ProtectedRoute/AdminRoute/require_role）
- **D-04: 不改 post-login 重定向** — `GuestRoute`/`login.tsx` 的 `/user/dashboard`、`/admin/dashboard` 目标不变（`routing.spec.ts` 有无守卫的 `toHaveURL` 断言；改落地页超出 AVUI-02 字面范围）

### AVUI-01 验证与打磨
- **D-05: 验证优先，不重构** — `avatar-page.tsx` 已满足结构要求（standalone 路由、answer→transcript / citations→SourcesPanel 永不合并、桌面右栏 border-l / 移动 Sheet）；本 phase 不 wrap 任何 layout、不引入新抽象
- **D-06: 新增 chrome-absence E2E 断言** — 在 `anonymous-avatar-qa.spec.ts`（或新 spec）加显式负断言：`/` 页面无 nav/sidebar/coach chrome（如 `expect(page.locator("nav")).toHaveCount(0)`），把 AVUI-01 的"清爽"从数据分离测试升级为回归可证
- **D-07: header 标题 key 复用检查** — `avatar-page.tsx:257` 复用 `sourcesPanel.title` 作页头标签属低优先级 cosmetic；若修正则换成独立 key 并补全 5 locale + parity（whitelist 已 15/15 满，不得新增豁免条目）

### 测试与回归基线
- **D-08: 有意更新 user-layout.test.tsx** — mock 的 `useConfig()` 补 `legacy_coach_nav_enabled: true`（既有"renders all"用例），并新增 flag=false 时导航项缺席的用例（`queryByText` + `not.toBeInTheDocument()`）——这是 AVUI-02 要求的单测覆盖，不是意外破坏
- **D-09: 后端 mock_settings 同步** — `test_config_api.py` 所有构造完整 `mock_settings` 的测试补设 `feature_legacy_coach_nav_enabled`（MagicMock 自动属性是 Mock 对象，Pydantic bool 校验会炸）
- **D-10: E2E 基线 = ~415 passed / 9 skipped / ~35 pre-existing failures** — 执行前先跑一次全量 E2E 重新捕获基线；"现有测试不破坏"判定标准是 **零新增失败**（pass→fail 的 delta 为零），35 个既有失败（stale mock data / 真实 Azure 连接类）不在本 phase 修复范围

### Claude's Discretion
- chrome-absence 断言的具体 selector 策略（`nav` count vs data-testid）
- 新 flag 在 `ConfigResponse`/`FeatureFlags` 中的字段排序位置
- AVUI-01 polish E2E 放进既有 spec 还是新建 `avatar-ui-clean.spec.ts`
- header 标题 key 是否修正（D-07 判定为 copy-paste artifact 时才动）

</decisions>

<specifics>
## Specific Ideas

- 遵循 CLAUDE.md 最高优先级流程：逐需求实现（AVUI-01 → AVUI-02），每个需求 100% 单测 + Playwright E2E 全过后独立 commit + push
- 用户全程离线授权：自主决策、loop engineering 完成 plan → ui-spec → execute → review → verify，各阶段依次 commit & push
- flag 命名语义为"显示 legacy coach 导航"（enabled=true 显示），默认 False 即隐藏 — 符合 Phase 01 "Feature toggles default to False" 决策

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与研究
- `.planning/ROADMAP.md` §Phase 35 — 成功标准原文
- `.planning/REQUIREMENTS.md` — AVUI-01/AVUI-02 需求原文
- `.planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-RESEARCH.md` — 全部 pitfall（MagicMock/Pydantic、guarded vs unguarded E2E、35-failure 基线解读）与 4 层 flag 管道的精确编辑点

### 既有决策（本 phase 直接依赖）
- `.planning/phases/32-anonymous-grounded-avatar-q-a/32-CONTEXT.md` — avatar 页布局与来源分离契约
- `.planning/phases/34-spanish-es-i18n/deferred-items.md` — E2E 全量基线（415/9/35）triage 记录

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/config.py` — 5 个既有 `feature_*_enabled` flag（全默认 False），新 flag 并列加入
- `backend/app/api/config.py` — `GET /config/features`：`FeatureFlags` Pydantic model + `get_features()`，`feature_conference_enabled` 是 env-only 无 DB 覆盖的先例
- `frontend/src/hooks/use-config.ts` — `useFeatureFlags(isAuthenticated)`，TanStack Query，`enabled: isAuthenticated`（匿名用户永远只见 defaultFlags）
- `frontend/src/contexts/config-context.tsx` — `defaultFlags`（全保守/off）+ `useConfig()`
- `frontend/src/types/config.ts` — `FeatureFlags` interface
- `frontend/src/components/layouts/user-layout.tsx:36-41` — `navItems` 数组（4 项），在桌面 nav（~line 85）与移动 Sheet nav（~line 156）两处渲染
- `frontend/src/pages/avatar-page.tsx` — AVUI-01 基线（standalone、结构分离已测）
- `frontend/e2e/navigation.spec.ts:18-22` — `if ((await link.count()) > 0)` 守卫式点击惯用法（保留此风格，勿引入第二种）

### Established Patterns
- flag 默认 False（Phase 01 决策）；UI 可见性 flag ≠ 访问控制
- E2E 守卫惯用法使 `navigation.spec.ts`/`admin-navigation.spec.ts` 在链接缺席时静默 no-op（隐藏 UserLayout 导航不破坏它们）
- 零新依赖、零 Alembic 迁移、零新后端路由（flag 走既有 `/config/features`）

### Integration Points
- `Settings` → `config.py` API → `types/config.ts` → `config-context.tsx` defaultFlags → `user-layout.tsx` 消费：共 5 个文件的机械编辑即 AVUI-02 全部代码面
- `voice-live-proxy.spec.ts:489` 无守卫 admin 断言 = AdminLayout 不可动的硬约束
- `routing.spec.ts` 无守卫 `toHaveURL(/\/user\/dashboard/)` = 重定向目标不可动的硬约束

</code_context>

<deferred>
## Deferred Ideas

- AdminLayout coach 专属侧边栏项（HCP Profiles/Scenarios/Scoring Rubrics/Skill Hub）的隐藏 — 留给 CLEAN-01（彻底删除 coach 代码）
- flag 的 admin 自助 UI 开关（DB 覆盖 + settings.tsx 卡片 + 5 locale i18n）— 如需运行时切换再立项
- 登录后落地页改为 `/`（avatar 优先体验）— 需连同 `routing.spec.ts` 一起改，独立决策
- en-US/scoring.json 重复 key 修复（34 deferred item）— 与本 phase 无关

</deferred>

---

*Phase: 35-clean-avatar-ui-legacy-coach-hiding*
*Context gathered: 2026-08-02*
