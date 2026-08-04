# Requirements: AI Avatar Platform — Milestone v2.0 Avatar MVP

**Defined:** 2026-07-31
**Core Value:** Visitors and logged-in users get instant, accurate, multi-language answers from a digital human grounded in trusted knowledge sources — anonymous users draw from public site content, logged-in users get personalized answers shaped by their own profile and preferences.

> v1.0 (coach platform) requirements are archived in git history and recorded as Validated in PROJECT.md.
> Execution rule (CLAUDE.md top priority): one requirement at a time → 100% unit test → Playwright E2E → all pass → commit → push.

## v2.0 Requirements

### 匿名问答 (ANON)

- [x] **ANON-01**: 匿名访客无需登录即可打开 avatar 页面并以文本向数字人提问
- [x] **ANON-02**: 匿名回答基于官网内容知识库（Azure AI Foundry IQ 索引）grounding，仅使用授权知识来源
- [x] **ANON-03**: 每个回答附来源引用（page + document link），且与回答内容作为独立 UI 元素分离展示
- [x] **ANON-04**: 匿名访客可获得数字人语音回答（Voice Live avatar）
- [x] **ANON-05**: 匿名端点具备限流与滥用防护（slowapi 限流 + 会话配额 + 交互审计日志）

### 登录个性化 (PERS)

- [x] **PERS-01**: 管理员可上传 Excel CRM 对应关系表（userid → CRM 知识 / 对口支持人），系统解析入库
- [x] **PERS-02**: 登录用户提问时，系统按 userid 将 CRM 上下文与用户偏好注入 system prompt / prompt template（chat-time 注入，含 prompt-injection/PII sanitization）
- [x] **PERS-03**: 管理员可通过界面查看和手动编辑用户偏好标签（人工打标签）

### 西班牙语支持 (LANG)

- [x] **LANG-01**: UI 全量支持西班牙语（es）— 所有 locale namespace 补齐 es 翻译，语言切换器含 es，含 key-parity 校验
- [x] **LANG-02**: 数字人可用西班牙语语音回答（es-* neural voice）

### 清爽 Avatar UI (AVUI)

- [x] **AVUI-01**: avatar 页面仅展示数字人 + 文档链接信息 — 数字人语音内容与文档来源展示视觉分离
- [x] **AVUI-02**: 旧 coach 功能导航入口通过 feature flag 隐藏（代码与路由保留，现有测试不破坏）

## v2.1 Requirements — Avatar Persona & Post-Login Experience

> Approved 2026-08-02. Constraint: Azure Voice Live standard avatars only (prebuilt characters e.g. Lisa/Harry/Meg/Max + styles); no Custom Avatar training. No forced persona-selection page — the admin-marked default persona is the fallback for anonymous visitors and users without a saved choice.

### 数字人 Persona (PERSONA)

- [x] **PERSONA-01**: 管理员可管理数字人 Persona 列表（增删改、启用/禁用）— 每个 Persona 含名称、Azure 预置 avatar character+style、按语言的 voice、问候语/persona prompt 片段
- [x] **PERSONA-02**: 管理员可将且仅将一个启用的 Persona 标记为默认 — 匿名访客与未选择的登录用户自动使用默认 Persona
- [x] **PERSONA-03**: 登录用户可在 avatar 页内切换 Persona（切换重建会话，沿用西语切换惯例），选择持久化为 `selected_persona_id` 并在下次登录生效
- [x] **PERSONA-04**: avatar 会话实际使用当前 Persona 的 character/style/voice 并播报其问候语；persona prompt 片段与 CRM/偏好上下文一同注入（复用既有 sanitization）

### 登录落地 (LAND)

- [x] **LAND-01**: 普通用户登录后直达 avatar 页（`/`）并加载个人记忆（PERS-02 注入）与已记住的 Persona；admin 登录仍落 /admin/dashboard

## v2.2 Requirements — Persona Fidelity & Hardening (Gap Closure)

> Approved 2026-08-02 (post-Phase-36 gap analysis). Phase 36 delivered persona catalog/switching audio-first; v2.2 closes the fidelity gaps so a persona switch is fully observable (visual + conversational) and hardens data integrity.

### Persona 保真 (PERSONA, continued)

- [x] **PERSONA-05**: avatar 会话的数字人**视频形象**真正应用当前 Persona 的 character/style — WebRTC session config 携带 persona 的 avatar character+style，切换 Persona 后屏幕上的数字人形象随之变化（匿名与登录路径一致）
- [x] **PERSONA-06**: persona prompt 片段作用于**语音对话通道** — Voice Live session 的 instructions 携带 sanitized persona 片段（登录路径合并 CRM/偏好上下文），语音问答的人格/语气随 Persona 变化，复用双闸 sanitization
- [x] **PERSONA-07**: 问候语按语言 — greeting 从单一字符串改为 per-locale map（与 voice_map 同构），按当前 locale 解析并回退（persona 任一可用 locale → 默认文案）；admin 表单支持按语言编辑问候语，数据迁移保留既有问候语

### 加固 (HARD)

- [x] **HARD-01**: 数据完整性加固 — `is_default` 唯一性提升为 DB 级约束（partial unique index，enabled+is_default）；persona 相关 E2E 测试自带数据清理（teardown 删除测试创建的 persona 并恢复默认），dev DB 不再被测试运行污染

## v2.3 Requirements — Persona Editor Foundry Parity

> Approved 2026-08-04 (post persona-editor voice-mode redesign, debug session avatar-persona-voice-mode-config). The persona editor was rebuilt to mirror the HCP profile editor's "语音和数字人" layout; v2.3 closes the functional gaps so a persona is a first-class Foundry-backed agent like an HCP profile.

### Persona 编辑器 (PEDIT)

- [ ] **PEDIT-01**: Persona ↔ AI Foundry agent 同步 — 保存 persona 时创建/更新对应的 AI Foundry agent（与 HCP profile 的 agent provisioning 机制一致），instructions/voice/model 等配置与 Foundry agent 保持同步
- [ ] **PEDIT-02**: Persona 级知识库挂载（Foundry IQ）— persona 可挂载知识库用于回答 grounding（后端解除 `hcp_profiles` 硬绑定），编辑器提供知识库添加/移除 UI（与 HCP 页"知识库与工具"一致）
- [ ] **PEDIT-03**: 模型部署持久化 — `AvatarPersona` 持久化 model deployment 字段（迁移），编辑器下拉选择并保存，会话/agent 实际使用所选部署
- [ ] **PEDIT-04**: 自动生成指令 — 基于 persona 字段自动生成 instructions（带"重新生成"按钮），自定义指令留空则使用自动生成结果（与 HCP 页行为一致）
- [ ] **PEDIT-05**: 工作台实时试聊 — 编辑器右侧工作台"开始"按钮可用，管理员可直接与该 persona 试聊（复用现有 voice session 机制）
- [ ] **PEDIT-06**: Voice 与 Language 联动 — voice 列表补齐西班牙语声音（es-ES/es-MX/es-US），并按所选 language 过滤/联动展示，不再展示与语言不符的声音

### 品牌文案 (BRAND)

- [ ] **BRAND-01**: 全站 "AI Coach" 字样统一改为 "AI Avatar"（所有 locale 的 UI 文案、页面标题、导航等），不改动代码标识符与 API 路径

## Future Requirements

- **PERS-04**: 后台自动抽取用户偏好（自动 memory 机制）
- **PERS-05**: 真实 CRM 系统集成（替换 Excel POC）
- **CLEAN-01**: 彻底删除 coach 业务代码（前后端）

## Out of Scope

| Feature | Reason |
|---------|--------|
| CRM 系统集成 | POC 用 Excel 对应关系表，客户确认不做真实 CRM 对接 |
| 深度自动 memory 机制 | 偏好由后台抽取或人工打标签，POC 不做自动学习记忆 |
| 删除 coach 代码 | v2.0 仅隐藏入口降低风险，删除留到后续里程碑 |
| 匿名会话跨浏览器会话持久化 | 匿名会话为临时会话，登录后另起个性化会话 |
| 西语中途切换不重连 | avatar 层西语与 mid-session 切换机制需 spike 验证，MVP 允许切换语言时重建会话 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANON-01 | Phase 32 | Complete |
| ANON-02 | Phase 32 | Complete |
| ANON-03 | Phase 32 | Complete |
| ANON-04 | Phase 32 | Complete |
| ANON-05 | Phase 32 | Complete |
| PERS-01 | Phase 33 | Complete |
| PERS-02 | Phase 33 | Complete |
| PERS-03 | Phase 33 | Complete |
| LANG-01 | Phase 34 | Complete |
| LANG-02 | Phase 34 | Complete |
| AVUI-01 | Phase 35 | Complete |
| AVUI-02 | Phase 35 | Complete |
| PERSONA-01 | Phase 36 | Complete |
| PERSONA-02 | Phase 36 | Complete |
| PERSONA-03 | Phase 36 | Complete |
| PERSONA-04 | Phase 36 | Complete |
| PERSONA-05 | Phase 37 | Complete |
| PERSONA-06 | Phase 37 | Complete |
| PERSONA-07 | Phase 37 | Complete |
| HARD-01 | Phase 37 | Complete |
| LAND-01 | Phase 36 | Complete |
| PEDIT-01 | Phase 38 | Planned |
| PEDIT-02 | Phase 38 | Planned |
| PEDIT-03 | Phase 38 | Planned |
| PEDIT-04 | Phase 38 | Planned |
| PEDIT-05 | Phase 38 | Planned |
| PEDIT-06 | Phase 38 | Planned |
| BRAND-01 | Phase 38 | Planned |

**Coverage:**
- v2.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-07-31*
*Last updated: 2026-07-31 — roadmap created (Phases 32-35)*
