# Phase 34: Spanish (es) i18n - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The platform fully supports Spanish across UI text and avatar voice, alongside existing zh-CN/en-US. Per user decision, Spanish ships as **three complete locale variants** — `es-ES`（西班牙）、`es-MX`（墨西哥）、`es-US`（美国西语）— each with its own full UI translation set, language-switcher entry, refusal template, and matching es-* neural voice; UI、翻译、口语全区分（LANG-01 + LANG-02）. An automated key-parity check covers all five locales (zh-CN/en-US/es-ES/es-MX/es-US). Mid-session language switch rebuilds the avatar session (MVP-permitted). Depends on Phase 32 avatar infrastructure. Legacy coach hiding and layout unification are Phase 35.

</domain>

<decisions>
## Implementation Decisions

### 西语变体范围与翻译产出（LANG-01）
- **D-01: 三套完整西语 locale** — es-ES / es-MX / es-US 各自独立：UI 翻译文件（`public/locales/{lng}/` 16 个 namespace 全量）、切换器选项、拒答模板、neural voice；用户明确要求「从 UI、翻译到口语都区分开」，不是单套中性西语
- **D-02: Claude 直接生成全部翻译** — 以 en-US 为源文本逐 namespace 生成三套 es；es-ES 用伊比利亚半岛用词（vosotros/ordenador 等），es-MX 与 es-US 用拉美用词（ustedes/computadora），整体采用正式 usted 敬称语域（专业场景）；POC 阶段不引入外部翻译流程
- **D-03: 未翻译白名单** — 品牌名/专有名词等三语相同的值通过白名单豁免「未翻译检测」，白名单初始清单由实现时确定

### Key-parity 校验机制（LANG-01 成功标准）
- **D-04: vitest 全局 parity 测试** — 新增测试遍历 `frontend/public/locales/` 下全部 namespace JSON，递归比对 5 个 locale 的 key 集合完全一致；随 `npm test` 运行，CI 自然覆盖，不新增工具链
- **D-05: 三重深度校验** — 除 key 齐全外：① 空值检查（翻译值不得为空串/纯空白）② 插值占位符一致（同一 key 的 `{{var}}` 变量名跨语言一致）③ 未翻译检测（es 值 == en-US 值视为可疑，白名单豁免）

### es 语音与回退（LANG-02）
- **D-06: voice_map 按 locale 1:1 扩展** — `PublicKnowledgeConfig.voice_map` JSON 新增 `es-ES`/`es-MX`/`es-US` 三个 key（结构 Phase 32 已预留）；Admin 公共配置页可编辑，预置 Azure 默认音色：es-ES-ElviraNeural / es-MX-DaliaNeural / es-US-PalomaNeural
- **D-07: 内置默认回退，不阻断** — 会话创建时所选 locale 在 voice_map 未配置 → 回退到该 locale 的内置默认音色常量；绝不因缺配置阻断会话
- **D-08: 拒答模板补齐三个 es-\* key** — `avatar_service.py` REFUSAL_TEMPLATES（及 personalized 变体）新增 es-ES/es-MX/es-US 条目，用词按变体区分

### 切换器 UX 与 locale 解析
- **D-09: 切换器 5 选项** — zh-CN 🇨🇳 / en-US 🇺🇸 / es-ES 🇪🇸 / es-MX 🇲🇽 / es-US 🇺🇸；西语 label 用本地语自称（如 Español (España) / Español (México) / Español (EE. UU.)），`common.json` 的 `lang.*` key 相应扩展；es-US 与 en-US 旗帜相同，靠 label 区分
- **D-10: 浏览器检测归一到 es-ES** — navigator 报 `es` 或未列出的 es-* 变体（es-AR 等）时解析到 es-ES（canonical 西语默认）；i18next fallback 链 es-* → es-ES → en-US；具体用 supportedLngs + fallbackLng 映射实现，细节 research 确认
- **D-11: mid-session 切语言重建会话** — 沿用现有 `avatar-page.tsx` 行为（`i18n.language` 变化触发重连），成功标准明确允许 rebuild 而非 live reconnect；无需新代码路径，仅验证 es-* 走通

### Claude's Discretion
- i18next supportedLngs/fallbackLng/nonExplicitSupportedLngs 的具体配置组合
- 未翻译白名单的初始条目
- 默认音色常量的存放位置（config vs service 常量）
- Admin voice_map 编辑 UI 对三个新 key 的呈现样式
- Playwright E2E 中语音链路的 mock 深度（真实 WebRTC 不可在 CI 建连）

</decisions>

<specifics>
## Specific Ideas

- 切换语言后 avatar 页整链路应生效：UI 文案、字幕/转写、拒答话术、语音音色全部切到所选 es 变体
- 遵循 CLAUDE.md 最高优先级流程：逐需求实现（LANG-01 → LANG-02），每个需求 100% 单测 + Playwright E2E 全过后独立 commit + push
- 用户全程离线授权：自主决策、loop engineering 完成 plan → ui-spec → execute → review → verify，各阶段依次 commit & push

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 34 — 2 条成功标准（西语 UI 无缺 key 回退，key-parity 自动校验；es-* neural voice 回答，mid-session 切换可 rebuild）
- `.planning/REQUIREMENTS.md` — LANG-01/LANG-02 需求原文

### 既有决策（本 phase 直接依赖）
- `.planning/phases/32-anonymous-grounded-avatar-q-a/32-CONTEXT.md` — voice_map per-language 结构预留、拒答多语言模板（Phase 34 补 es）、avatar 页布局
- `.planning/phases/33-personalized-crm-excel-avatar/33-CONTEXT.md` — auth 感知 avatar 页（D-13）、personalized 会话链路

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/i18n/index.ts` — i18next 初始化：HttpBackend 加载 `/locales/{{lng}}/{{ns}}.json`，`supportedLngs: ["en-US", "zh-CN"]`（需加 3 个 es-*），16 个 namespace
- `frontend/public/locales/{en-US,zh-CN}/` — 16 个 namespace JSON（en-US 合计 ~1,800 行），es-ES/es-MX/es-US 三套镜像目录为本 phase 主要产出
- `frontend/src/components/shared/language-switcher.tsx` — 硬编码 2 语言数组 + 旗帜，扩到 5
- `backend/app/models/public_knowledge_config.py` — `voice_map` JSON Text 字段已按 locale key 设计（`{"zh-CN": ..., "en-US": ...}`），无需迁移即可加 es-* key
- `backend/app/api/public_avatar.py:80-81` — `voice_map.get(body.locale, "")` 会话创建时取音色，回退逻辑挂靠点
- `backend/app/services/avatar_service.py:31` — `REFUSAL_TEMPLATES` dict（zh-CN/en-US），`.get(locale, zh-CN)` 回退；personalized_avatar_service.py 有对应引用
- `frontend/src/pages/avatar-page.tsx:118-143` — `useAnonymousVoiceLive(token, {locale: i18n.language})`，`useEffect` 依赖 `[i18n.language]` 已实现切语言重连
- `frontend/src/__tests__/hcp-editor-tabs.test.tsx` — 既有单组件 key-parity 测试可作全局 parity 测试的模式参照
- `frontend/src/i18n/index.test.ts` — 断言 supportedLngs/ns 的现有测试，加 es 后需同步更新

### Established Patterns
- locale 目录在 `frontend/public/locales/`（HTTP backend 运行时加载，非打包 import）— es 三套目录同构
- vitest 单测 + Playwright E2E（`e2e/playwright.config.ts`）；CI 顺序 backend-test → frontend-test → e2e-test
- 数据库无 schema 变更需求（voice_map 已是自由 JSON），本 phase 预计零 Alembic 迁移

### Integration Points
- `i18n/index.ts` supportedLngs + 检测归一（D-10）是 es 生效的开关
- 语言切换 → avatar 会话重建 → `public_avatar.py` 按新 locale 取 voice_map → Voice Live 用 es-* 音色，链路已存在只需数据补齐 + 回退加固
- Admin 公共配置页 voice_map 编辑 UI 需呈现 5 个 locale 条目
- 拒答模板、AvatarInteractionLog 的 locale 字段随之接受 es-* 值

</code_context>

<deferred>
## Deferred Ideas

- 更多西语变体（es-AR/es-CO 等）与其它语言扩展 — 检测归一规则（D-10）已为未列出变体兜底
- Legacy coach 隐藏与布局统一 — Phase 35

</deferred>

---

*Phase: 34-spanish-es-i18n*
*Context gathered: 2026-08-01*
