# Phase 32: Anonymous Grounded Avatar Q&A — Discussion Log

**Date:** 2026-07-31
**Mode:** discuss (interactive)
**Areas selected by user:** 匿名入口与会话模型 / 语音交互范围与成本 / 来源引用展示与无匹配回退
**Area skipped (defaults applied):** 限流与审计策略 — 按 `.planning/research/SUMMARY.md` 默认方案（slowapi + 会话配额 + AvatarInteractionLog）

---

## Area 1: 匿名入口与会话模型

| # | Question | Options | Answer |
|---|----------|---------|--------|
| 1 | 匿名访客从哪里进入 avatar 页？ | 根路径即 avatar 页（推荐）/ 独立 /avatar 公开路由 | **根路径即 avatar 页** — `/` 直接展示匿名问答页，登录入口放页角 |
| 2 | 匿名会话如何标识与防伪造？ | 后端签发匿名 session token（推荐）/ 服务端 httpOnly cookie / 前端生成 UUID | **后端签发匿名 session token** — POST /public/avatar/session 创建 AnonymousAvatarSession，返回短期签名 token |
| 3 | 匿名会话的生命周期策略？ | 无活动 30 分钟过期（推荐）/ 浏览器标签页生命周期 / 长期匿名会话 | **无活动 30 分钟过期** — 前端静默重建；配额按会话+IP 双重限制 |
| 4 | 公共知识库绑定由谁配置？ | Admin 界面配置（推荐）/ 环境变量固定 | **Admin 界面配置** — 新增 PublicKnowledgeConfig，复用 Phase 17 KB 选择 UI |

## Area 2: 语音交互范围与成本

| # | Question | Options | Answer |
|---|----------|---------|--------|
| 1 | 匿名访客的提问输入方式？ | 仅文本输入（推荐）/ 文本+麦克风语音提问 | **文本 + 麦克风语音提问**（用户否决保守推荐，选完整双向语音） |
| 2 | 数字人 Avatar 何时启动？ | 首次提问时启动 / 进页即连常驻 | **进页即连，数字人常驻**（展示效果优先） |
| 3 | 匿名场景用哪条传输路径？ | WebSocket 代理（推荐）/ WebRTC 直连 | **WebRTC 直连** — 附加缓解：临时凭据短 TTL、仅凭匿名 session token 领取 |
| 4 | 是否设全局并发上限？ | 设并发上限（推荐）/ 不设上限只靠限流 | **不设上限，只靠限流**（slowapi + 会话配额） |
| 5 | 匿名数字人用哪个形象与声音？ | Admin 可配公共 avatar 配置（推荐）/ 代码固定默认 | **Admin 可配** — 形象/风格 + 按语言 neural voice，为 Phase 34 西语留结构 |
| 6 | 麦克风不可用时的体验？ | 静默降级纯文本（推荐）/ 弹窗引导授权 | **弹窗引导授权** — 解释用途引导开启；失败仍可文本提问 |
| 7 | 语音回答与文字回答的关系？ | 语音+文字同步展示（推荐）/ 仅语音文字可展开 | **语音 + 文字同步展示** |

## Area 3: 来源引用展示与无匹配回退

| # | Question | Options | Answer |
|---|----------|---------|--------|
| 1 | 来源引用在页面上怎么展示？ | 独立来源面板（推荐）/ 每条回答下的来源卡片 | **独立来源面板** — 侧边固定「参考来源」面板，随回答刷新；对齐 Phase 35 布局 |
| 2 | 每次回答展示几条来源引用？ | 最多 3 条（推荐）/ 全部命中 / 仅 1 条 | **最多 3 条** — 相关度最高的前 3 条 |
| 3 | 引用条目展示什么内容？ | 尽力展示+降级（推荐）/ 严格要求全字段 | **严格要求全字段**（用户否决降级方案）— 标题+URL+页码缺一不展示；research 需验证索引 sourceDataFields，缺失则含索引改造 |
| 4 | 知识库无匹配时怎么回退？ | 固定拒答话术（推荐）/ LLM 生成式婉拒 / 拒答+推荐问题 | **固定拒答话术** — 预设多语言模板，引用面板置空，零编造 |

---

## Notable Divergences from Recommendations

用户在三处否决了保守推荐，方向一致：优先展示效果与来源可信度，接受更高实现/索引要求：
1. 完整双向语音（非纯文本输入）
2. WebRTC 直连（非 WebSocket 代理）+ 不设并发上限
3. 引用严格全字段（非降级展示）— 将索引质量要求变为硬约束

**Output:** `32-CONTEXT.md`
