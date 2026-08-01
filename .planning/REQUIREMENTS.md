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
- [ ] **LANG-02**: 数字人可用西班牙语语音回答（es-* neural voice）

### 清爽 Avatar UI (AVUI)

- [ ] **AVUI-01**: avatar 页面仅展示数字人 + 文档链接信息 — 数字人语音内容与文档来源展示视觉分离
- [ ] **AVUI-02**: 旧 coach 功能导航入口通过 feature flag 隐藏（代码与路由保留，现有测试不破坏）

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
| LANG-02 | Phase 34 | Pending |
| AVUI-01 | Phase 35 | Pending |
| AVUI-02 | Phase 35 | Pending |

**Coverage:**
- v2.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-07-31*
*Last updated: 2026-07-31 — roadmap created (Phases 32-35)*
