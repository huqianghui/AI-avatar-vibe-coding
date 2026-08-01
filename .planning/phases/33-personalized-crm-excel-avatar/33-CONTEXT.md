# Phase 33: Personalized CRM-Excel Avatar - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Logged-in users receive avatar answers personalized via CRM-derived context (Excel POC upload, keyed by user email) and manually-tagged preferences. Admin uploads the Excel CRM mapping which is parsed and stored (PERS-01); at chat time the user's CRM context and preference tags are injected into the avatar system prompt with prompt-injection/PII sanitization (PERS-02); admins can view and manually edit per-user preference tags (PERS-03). Auto preference extraction (PERS-04) and live CRM integration (PERS-05) are explicitly out of scope. Depends on Phase 32's avatar orchestration, citations, and session infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Excel CRM 映射格式与上传语义（PERS-01）
- **D-01: 固定列模板** — Excel 列结构固定：`user_email`（匹配键）、`customer_name`、`company`、`role`、`crm_notes`（自由文本知识）、`contact_person`；上传时严格校验表头，Admin 可下载标准模板（openpyxl 已在依赖中）
- **D-02: email 匹配** — `user_email` 列匹配平台 `User.email`；匹配不到的行标记为 unmatched，供 Admin 在导入结果中查看
- **D-03: 按用户合并更新** — 重新上传时按匹配到的用户 upsert（存在则更新、不存在则新增），Excel 中缺失的用户保留旧数据；非整表替换
- **D-04: 分级校验** — 表头错误整体拒绝（400 + 期望格式提示）；行级错误（缺字段/匹配不到用户）跳过并报告，返回「成功 N 行、跳过 M 行 + 原因明细」

### 个性化注入与净化策略（PERS-02）
- **D-05: 结构化模板段落注入** — system prompt 固定模板预留「用户背景」段，字段名 + 净化后的值逐行拼接（如 Customer: X / Company: Y / Preferences: a, b），与 Phase 32 `prompt_builder.py` 模式一致
- **D-06: 规则净化，双重把关** — 字段长度上限 + 控制字符/prompt 分隔符过滤（```、`system:` 等）+ 常见指令注入模式剥离（"ignore previous instructions" 类）；入库时与注入前各执行一次；不引入 LLM 二次审查
- **D-07: 允许业务字段、过滤敏感模式** — customer_name/company/role/crm_notes/contact_person 本身允许注入（个性化目的所在）；对 crm_notes 自由文本扫描可正则识别的 PII（身份证/银行卡号/电话/邮箱等）替换为占位符
- **D-08: 无 CRM 数据静默回退** — Excel 里没有该用户时 prompt 不含个性化段，行为等同匿名知识问答；已有偏好标签（若 Admin 已打标）仍可注入；用户无感知

### 偏好标签模型与 Admin UI（PERS-03）
- **D-09: 预定义分类 + 自由值** — 标签 = 分类（如「沟通风格」「关注领域」「语言偏好」）+ 自由文本值；分类保证注入 prompt 时可组织，值的净化规则同 CRM 字段
- **D-10: 独立 UserPreference 表** — `UserPreference(user_id, category, value)` + `TimestampMixin` + Alembic 迁移；与 CRM 数据（UserCrmContext 表）分离，Excel 重传不影响标签，为 Phase 34+ 自动提取预留扩展点
- **D-11: 扩展现有 Admin 用户管理页** — 用户详情/编辑入口新增「个性化」区块：CRM 匹配状态（只读）+ 偏好标签增删改；不新建独立标签管理页
- **D-12: Admin 设置区新增「CRM 数据」页** — 与 PublicKnowledgeConfig 同级的独立配置页：上传 Excel、下载模板、查看上次导入结果（成功/跳过/unmatched 明细）

### 登录用户的 avatar 入口 UX
- **D-13: 同一页面 auth 感知** — `/` 同一 avatar 页：未登录走匿名会话，已登录自动创建个性化会话（JWT 鉴权）；UI 布局、引用面板、语音链路全部复用，只换会话创建路径与 prompt
- **D-14: 轻量个性化标识** — 页角/顶部显示用户名 + 小标识（如「专属模式」徽章），不展示任何 CRM 内容
- **D-15: 复用 avatar 会话链路，JWT 鉴权变体** — 新增认证版会话端点（如 `POST /avatar/session`，`Depends(get_current_user)`），会话记录标记 personalized + user_id，复用 Phase 32 的会话生命周期/配额/审计（AvatarInteractionLog）基础设施；登录用户配额可宽于匿名

### Claude's Discretion
- Excel 单元格级校验细节（空值处理、长度上限具体数值）
- 净化正则/指令注入模式的具体清单
- 预定义偏好分类的初始集合与 i18n 文案
- 登录用户配额的具体数值
- Admin「CRM 数据」页与导入结果明细的视觉样式

</decisions>

<specifics>
## Specific Ideas

- 个性化段注入示例形态：system prompt 中固定「用户背景」区块，形如 `Customer: 张三 / Company: XX医院 / Role: 主任医师 / Preferences: 沟通风格=简洁, 关注领域=肿瘤免疫`
- 导入结果报告需含三类明细：成功行数、跳过行（原因）、unmatched 行（email 未匹配到平台用户）
- 遵循 CLAUDE.md 最高优先级流程：逐需求实现（PERS-01 → 02 → 03），每个需求 100% 单测 + Playwright E2E 全过后独立 commit + push

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 33 — 3 条成功标准（Excel 上传解析存储；聊天时净化注入个性化回答；Admin 偏好标签编辑 UI）
- `.planning/REQUIREMENTS.md` — PERS-01..03 需求原文；PERS-04/05 明确 out of scope

### Phase 32 既有决策与实现（本 phase 直接依赖）
- `.planning/phases/32-anonymous-grounded-avatar-q-a/32-CONTEXT.md` — 匿名会话模型、`/` avatar 页、引用面板、拒答模板等已锁定决策
- `.planning/phases/32-anonymous-grounded-avatar-q-a/32-RESEARCH.md` — avatar_service 编排、影子检索、会话/审计架构

### 里程碑研究
- `.planning/research/SUMMARY.md` — v2.0 研究综述（AvatarInteractionLog、审计与限流方案）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/prompt_builder.py` — Phase 32 系统提示构建器，个性化段在此扩展注入点
- `backend/app/services/avatar_service.py` — avatar 问答编排器，个性化会话复用同一编排路径
- `backend/app/api/public_avatar.py` + `backend/app/services/anonymous_session_service.py` — 会话签发/生命周期/配额参照实现，新增 JWT 认证变体
- `backend/app/api/admin_users.py` — Admin 用户管理端点，偏好标签 CRUD 挂靠处
- `backend/app/models/public_knowledge_config.py` + 对应 Admin 配置页 — 「CRM 数据」配置页的同级参照
- `backend/pyproject.toml` 已含 `openpyxl>=3.1.0` — Excel 解析无需新依赖

### Established Patterns
- 所有 API 在 `/api/v1/` 前缀下、结构化错误响应、`TimestampMixin` + Alembic 迁移 — 新模型（UserCrmContext、UserPreference）遵循
- `backend/app/dependencies.py` 的 `get_current_user` — 个性化会话端点直接使用；Admin 端点沿用现有 RBAC（admin role）校验模式
- Phase 32 的 AvatarInteractionLog 审计 — 个性化会话交互同样落审计，标记 personalized

### Integration Points
- `prompt_builder.py` 需要新增「用户背景」段组装入口，从 UserCrmContext + UserPreference 读取并净化
- 会话创建端点分叉：匿名（Phase 32 现有）vs 认证（本 phase 新增），下游 Voice Live/WebRTC 凭据签发路径复用
- 前端 `/` avatar 页：auth store 已有登录态，页面按登录态选择会话创建 API；新增轻量「专属模式」标识
- 净化模块（sanitizer）应独立成可测试单元（utils 或 service），入库与注入两处调用

</code_context>

<deferred>
## Deferred Ideas

- 自动偏好提取/深度记忆 — PERS-04，post-POC
- 实时 CRM 集成 — PERS-05，post-POC
- 西语 i18n（含拒答/标识文案 es）— Phase 34
- Legacy coach 隐藏与布局统一 — Phase 35

</deferred>

---

*Phase: 33-personalized-crm-excel-avatar*
*Context gathered: 2026-08-01*
