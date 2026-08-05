# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.3 — Voice Mode Config (Foundry Portal Style)

**Shipped:** 2026-08-05
**Phases:** 1 (Phase 38) | **Plans:** 3

> Note: v2.0 (Phases 32–35), v2.1 (Phase 36), and v2.2 (Phase 37) were completed but never formally
> archived; their phase details were swept into the v2.3 archive (`milestones/v2.3-ROADMAP.md`) and
> the first MILESTONES.md entry, which is why that entry counts 6 phases / 34 plans.

### What Was Built
- HcpProfile 恢复 6 个内联 voice/avatar 字段（Alembic g40a 迁移 + 从关联 VoiceLiveInstance 回填），`resolve_voice_config()` 改为直接读内联字段，21-key 输出形状不变，消费方（voice_live_websocket / agent_sync_service）零改动
- HCP 编辑页 Voice Live Instance 选择卡替换为 Foundry-portal 风格直接配置卡（model deployment / language / speech-output voice / avatar 开关 + AvatarCharacterGallery 共享组件），顺带修复了后端序列化静默丢字段的真实 bug
- Persona 编辑页对齐：复用共享 AvatarCharacterGallery 与 voice-constants，Speech output 分区标题统一 5 locale

### What Worked
- 当天 rescope（PEDIT-01..06/BRAND-01 延后，只做 VMODE-01/02）让 milestone 一天内 3 plan 全部交付并通过验证
- "保持 `resolve_voice_config()` 输出形状不变" 的契约式重构策略使消费方零改动、回归面最小
- 共享组件先行（38-02 建 AvatarCharacterGallery，38-03 直接复用）避免了 persona 编辑页的重复实现

### What Was Inefficient
- 38-02 发现的后端序列化 bug（HcpProfileOut 丢字段）本应在 38-01 的 API 测试中暴露 — schema 与 router 的 Out 模型不同步是重复出现的坑
- 遗留 VoiceLiveInstance CRUD 端点保留但已无行为影响（WR-01），产生了"配置了却不生效"的潜在管理员困惑，清理被推迟

### Patterns Established
- 契约冻结重构：替换数据来源时冻结解析函数输出形状，用现有测试锁定契约
- 共享 admin 配置组件放 `frontend/src/components/admin/`（AvatarCharacterGallery）+ 常量去重到 `lib/voice-constants.ts`

### Key Lessons
1. Milestone 完成后要及时归档 — v2.0/v2.1/v2.2 未归档导致 v2.3 归档时统计混入前三个 milestone 的内容
2. 新增/恢复 ORM 列时，同步检查所有 `*Out` schema（router 内联的局部 Out 模型最容易漏）
3. 被替换机制的旧 CRUD 面（VoiceLiveInstance）应在同一 milestone 内至少标注 deprecated，避免静默失效

### Cost Observations
- Model mix: quality profile (opus executor / sonnet verifier)
- Notable: 单日完成 3 plan + 验证 + code review；rescope 是关键效率决策

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v2.0–v2.2 | 6 | Shipped without formal archival — swept into v2.3 archive retroactively |
| v2.3 | 1 | First formal milestone archival + retrospective; same-day rescope discipline |

### Top Lessons (Verified Across Milestones)

1. 契约冻结（保持函数输出形状/API 响应形状不变）是低风险重构的核心手段（Phase 29 resolve_voice_config、Phase 38 同函数二次重构均验证）
2. 共享组件/常量先建后用，避免 admin 页面间重复实现（Phase 36 PersonaDialog、Phase 38 AvatarCharacterGallery）
