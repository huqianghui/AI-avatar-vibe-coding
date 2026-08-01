# Phase 32: Anonymous Grounded Avatar Q&A - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Anonymous visitors can converse with the digital human avatar (text + voice) without login and receive knowledge-grounded, sourced answers from official website content (Foundry IQ index). Answers are spoken by the Voice Live avatar with synchronized text, and each answer shows clickable source citations in a distinct UI panel. Anonymous requests are rate-limited, quota-capped, and audit-logged; no endpoint accepts client-supplied agent/profile identifiers. Personalized (logged-in) answers, Spanish i18n, and legacy coach hiding are later phases (33–35).

</domain>

<decisions>
## Implementation Decisions

### 匿名入口与会话模型
- **根路径即 avatar 页** — `/` 直接展示匿名 avatar 问答页，无需登录；登录入口放页角（不再默认跳 /login）
- **后端签发匿名 session token** — `POST /public/avatar/session` 创建 `AnonymousAvatarSession` 记录，返回短期签名 token；后续所有匿名调用凭此 token，杜绝客户端自造标识
- **会话生命周期** — 无活动 30 分钟过期；前端静默重建新会话；配额按「会话 + IP」双重限制
- **公共知识库绑定由 Admin 界面配置** — 新增 `PublicKnowledgeConfig`（单例配置），复用 Phase 17 的 KB 列表/选择 UI；不用环境变量硬编码

### 语音交互范围与成本
- **输入方式：文本 + 麦克风语音提问** — 完整双向语音交互，不是纯文本输入
- **进页即连，数字人常驻** — 页面加载即建立 Voice Live 连接并展示数字人（展示效果优先于成本）
- **传输路径：WebRTC 直连** — 匿名场景走 WebRTC 直连路径；缓解措施：临时凭据必须短效期（short TTL）且只能凭有效匿名 session token 领取
- **不设全局并发上限** — 成本控制只靠限流（slowapi + 会话配额），不做并发闸门
- **Admin 可配的公共 avatar 配置** — avatar 形象/风格 + 按语言的 neural voice 存入 `PublicKnowledgeConfig`（或同级公共配置），为 Phase 34 西语音色预留 per-language 结构
- **麦克风不可用时弹窗引导授权** — 主动弹窗解释用途并引导开启麦克风；授权失败后仍可文本提问
- **语音 + 文字同步展示** — 数字人说话的同时文字答案同步渲染（字幕/转写形式）

### 来源引用展示与无匹配回退
- **独立来源面板** — 页面侧边固定「参考来源」面板，随每次回答刷新当前引用；与回答气泡完全分离（成功标准 3），与 Phase 35「数字人 + 独立文档链接面板」布局直接对齐
- **每次回答最多展示 3 条引用** — 取相关度最高的前 3 条
- **引用严格要求全字段** — 每条引用必须有「标题 + 可点击 URL + 页码」才展示，缺任一字段整条不显示；这对 Foundry IQ 索引建设提出硬要求（见 research 任务）
- **无匹配固定拒答话术** — 检索无命中/低相关度时，数字人用预设多语言拒答模板回应（如「抱歉，我目前只能回答与官网内容相关的问题」），引用面板置空，零编造风险

### Claude's Discretion
- 限流与审计策略细节 — 按里程碑研究默认方案：slowapi（IP 级）+ 会话配额 + `AvatarInteractionLog` 审计模型；具体阈值、日志字段由规划/实现阶段定
- 拒答的相关度阈值判定方式（检索空结果 vs 低分截断）
- 前端会话静默重建的具体时机与 UX 细节
- 来源面板的视觉样式、加载态、空态设计

</decisions>

<specifics>
## Specific Ideas

- 页面布局参考（用户确认的 ASCII 方案）：左侧大区域为数字人（语音+字幕）+ 底部输入框和麦克风按钮，右侧固定「参考来源」面板列出文档标题/页码/链接
- WebRTC 直连的滥用缓解由后端把关：ephemeral credential 短 TTL、仅凭匿名 session token 换取
- 拒答话术需多语言模板（zh-CN/en-US，Phase 34 补 es）

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑研究（架构提案与新模型清单）
- `.planning/research/SUMMARY.md` — v2.0 研究综述：AnonymousAvatarSession / AvatarInteractionLog / PublicKnowledgeConfig 模型提案、avatar_service.py 编排器、avatar_search_service.py（直连 AI Search retrieve REST 取 references[]）、单一共享公共 Foundry agent、slowapi 为唯一新依赖

### Foundry IQ / 知识库既有决策
- `.planning/phases/17-agent-knowledge-base-foundry-iq/17-CONTEXT.md` — 已锁定：平台只列出/选择 KB 不创建索引；多 KB 以独立 MCPTool 挂载；需要 RemoteTool connection

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 32 — 5 条成功标准（ANON-01..05）
- `.planning/REQUIREMENTS.md` — ANON-01..05 需求原文

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/voice_live_webrtc.py` + `frontend/src/hooks/use-voice-live-webrtc.ts` — Phase 29 WebRTC 直连路径，匿名场景复用（需绕开 JWT、改用匿名 session token 鉴权）
- `backend/app/api/voice_live.py` — `/webrtc/session` 等端点是临时凭据签发的参照实现（现全部 `Depends(get_current_user)`，需新增匿名公共变体）
- `backend/app/services/knowledge_base_service.py` — MCPTool 构建（`{endpoint}/knowledgebases/{index}/mcp`）与 KB 列表逻辑，Admin PublicKnowledgeConfig UI 直接复用 Phase 17 的 KB 选择组件
- `frontend/src/components/voice/` — avatar-view / voice-session / voice-transcript / voice-controls 组件，公共 avatar 页的 UI 基础

### Established Patterns
- 所有 API 在 `/api/v1/` 前缀下、结构化错误响应、`TimestampMixin` + Alembic 迁移 — 新模型（AnonymousAvatarSession、AvatarInteractionLog、PublicKnowledgeConfig）遵循
- `backend/app/dependencies.py` 只有 `get_current_user`（无 auto_error=False 变体）— 需要新增匿名 token 校验依赖（如 `get_anonymous_session`），不能复用 JWT 用户依赖
- 前端路由全部走 auth-guard（`frontend/src/router/auth-guard.tsx`），`/` 现在硬跳 /login — 需要开公开路由通道

### Integration Points
- **引用提取是关键技术风险**：MCP 工具路径不返回结构化引用；需要 `avatar_search_service.py` 直连 AI Search `retrieve` REST action（api-version=2026-05-01-preview）拿 `references[]`（docKey/sourceData）做「影子检索」。用户已锁定「引用严格全字段」，research 必须验证现有索引的 sourceDataFields 是否含文档 URL + 页码，缺失则本 phase 需包含索引字段改造/重建方案
- `backend/pyproject.toml` 无 slowapi — 新增依赖 `slowapi >=0.1.10`
- 后端无任何审计日志模型 — `AvatarInteractionLog` 全新建

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope（个性化、西语、legacy coach 隐藏本就属于 Phase 33–35）

</deferred>

---

*Phase: 32-anonymous-grounded-avatar-q-a*
*Context gathered: 2026-07-31*
