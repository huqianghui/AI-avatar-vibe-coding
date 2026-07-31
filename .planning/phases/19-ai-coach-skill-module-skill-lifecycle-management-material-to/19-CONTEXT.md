# Phase 19: AI Avatar Skill Module - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

构建 AI Avatar Skill 模块，实现 Skill 全生命周期管理（创建、编辑、发布、归档）。用户可上传培训材料（文档、PPT等），系统自动将其转换为结构化的 SKILL.md 格式培训技能包（含 SOP、考核内容、知识点）。Skill Hub 集中展示所有可用 Skill。管理员可将 Skill 关联到 Scenario，训练过程中 HCP Agent 依据 Skill SOP 内容与 MR 用户交互。

本阶段不包含 Dry Run 模拟测试（Phase 20）。

</domain>

<decisions>
## Implementation Decisions

### Skill 包结构与格式

- **D-01:** Skill 包结构对齐 agentskills.io 规范 — 一个 Skill 是一个完整的包（package），包含：`SKILL.md`（YAML frontmatter + Markdown body Coaching Protocol）+ 可选 `references/`（源培训文档/参考资料）+ 可选 `scripts/`（辅助脚本）+ 可选 `assets/`（模板和静态资源）+ 可选执行环境配置
- **D-02:** 每个 SOP 步骤包含完整字段集：标题、描述、要点提示(key_points)、常见异议(objections)、考核标准(assessment_criteria)、知识点(knowledge_points)、时间建议(suggested_duration)。这些字段在 Markdown body 内用结构化的 Coaching Protocol 格式组织
- **D-03:** 数据库采用拆分存储策略 — YAML frontmatter 解析为 DB 字段（name、description、compatibility 等 + metadata JSON 存放扩展字段），Markdown body 存为 `content` Text 字段，references/scripts/assets 各文件存为 `SkillResource` 表记录（含 resource_type、path、content 等）。导出时从 DB 字段反向组装完整 SKILL.md + 资源文件

### 材料转换流程

- **D-04:** 材料转 Skill 采用异步转换 + 实时状态轮询 — 上传后异步处理，前端轮询状态 (pending→processing→completed/failed)，大文件不卡 UI
- **D-05:** 材料转 Skill 支持的文件格式：PPTX、PDF、DOCX + 所有文本文件（TXT、MD 等）。PDF 使用 pdfplumber（表格支持好），PPTX 用 python-pptx，DOCX 用 python-docx
- **D-06:** 长文档转换采用"格式统一 → 语义切割 → 逐段提取 → 合并去重"策略 — 所有文件先统一转为 Markdown（保留标题层级、列表、表格结构），再按标题/章节边界优先切割（兼顾大小上限），每段独立提取要点/知识点，最后合并去重生成完整 SOP
- **D-07:** 分段切割的 token 上限作为可配置参数，Admin 可在设置中调整（默认值基于当前模型 context window，如 128K 模型默认 80K tokens/段）。参考 coaching-skill-creator 的 5 阶段转换流程（Document Intake → Content Extraction → Learning Design → Skill Assembly → Validation）
- **D-08:** 材料转换失败（failed 状态）支持基于已有材料重试 — 不需要重新上传，Admin 点击"重试"按钮即可基于已上传的材料重新触发转换流程

### SOP 编辑

- **D-09:** SOP 支持双轨编辑模式 — Admin 可手动编辑 SOP 内容，也可通过 AI 反馈式修改（输入修改意见，AI 根据意见重新生成）

### 质量门控

- **D-10:** L1 结构检查在 SOP 生成后自动触发（即时规则引擎），L2 AI 质量评估由 Admin 手动触发（异步处理）
- **D-11:** L2 六维度评分用雷达图 + 详情卡片展示 — 复用已有评分组件模式（类似 Scoring Rubrics 展示），每个维度可展开查看详细评价和改进建议
- **D-12:** 发布门控：L1 必须 PASS + L2 >= 50 分方可发布。50-69 分显示警告弹窗：展示低分维度及改进建议，Admin 可选"仍然发布"或"返回修改"。<50 分阻止发布
- **D-13:** L2 质量评估（Skill 内容质量）与 Scoring Rubrics（MR 训练表现评分）是独立的两个系统。L2 评的是"Skill 设计得好不好"（六维度：SOP完整性/考核覆盖度/知识准确性/难度合理性/对话逻辑性/可执行性），Scoring Rubrics 评的是"MR 做得好不好"

### Skill Hub 与管理 UI

- **D-14:** Skill Hub 列表页采用卡片网格布局 — 类似 Scenario 选择页风格，每张卡片展示名称、产品、状态徽章、质量评分、标签
- **D-15:** Skill 作为独立管理模块，与 Scenario 通过关联关系连接 — Admin 在 Scenario 编辑时可选择关联一个 Skill
- **D-16:** Skill Hub 是纯 Admin 功能 — MR 用户不直接接触 Skill 模块，MR 只通过选择 Scenario 间接使用 Skill。不需要 MR 用户视图
- **D-17:** Skill 详情页采用只读文件树 + 点击预览展示 — 左侧显示完整 Skill 包目录结构（SKILL.md / references/ / scripts/ / assets/），类似 VSCode 资源管理器风格。点击 SKILL.md 在右侧渲染 Markdown 内容，点击 references/ 文件显示文件信息+下载按钮，点击 scripts/ 文件显示代码内容

### Skill 生命周期与版本管理

- **D-18:** Skill 采用五态生命周期：`draft → review → published → archived`，另有 `failed` 状态（材料转换失败）。编辑已发布的 Skill 回到 draft，归档的 Skill 可恢复为 draft。review 状态表示"待审核"，需通过质量门控方可发布
- **D-19:** Skill 采用版本化管理（复用 MaterialVersion 模式）— 编辑已发布 Skill 时创建新版本（draft），原版本仍然生效。新版本发布后旧版本自动归档，Scenario 自动切换到最新发布版本
- **D-20:** Skill 材料独立存储（SkillMaterial）— 与现有 TrainingMaterial 模块完全独立，不交叉引用。上传到 Skill 的文档是 Skill 包的一部分（references/），不复用 TrainingMaterial 表

### Skill 分配与运行时集成

- **D-21:** Skill 与 Scenario 为一对一关联 — 一个 Scenario 关联一个 Skill，训练时 Agent 按该 Skill 的 SOP 执行。后期可扩展为多对多
- **D-22:** 训练时通过 `SkillManager.compose_instructions()` 将 Skill 内容注入 Agent — 从 DB 加载 Skill 内容，使用参考代码 `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py` 中的 SkillManager 模式，将 Skill 的 Coaching Protocol 内容组合进 Agent instructions。SkillManager 已在参考代码中验证可用，比 SkillsProvider 更稳定直接
- **D-23:** Scenario 编辑时只显示 published 状态的 Skill 供选择。Skill 归档后已关联的 Scenario 保留关联，训练时显示警告"Skill 已归档"但仍可训练（给 Admin 时间替换）。Skill 被删除时关联自动解除（skill_id 置 null）

### Skill Script 管理策略

- **D-24:** Skill Script 采用"轻量 Script + Backend 服务"分层策略 — `scripts/` 目录仅存放轻逻辑脚本（格式验证、简单计算、数据转换），复杂操作（AI 评估、材料转换、DB 操作、外部 API 调用）全部走 Backend Service API。Skill 是决策层（when/what），Backend 是执行层（how）
- **D-25:** script_runner 实现采用简单 `subprocess.run()` + timeout=30s — 因为 scripts 由 Admin 上传且为受控轻逻辑，不需要 Docker 隔离。SKILL.md 的 `compatibility` 字段声明运行时要求（如 `Requires python3`）。生产环境可按需升级为 Docker sandbox
- **D-26:** Skill 包的 `assets/` 目录存放模板和静态资源（如评估表模板、话术模板），通过 `read_skill_resource` 按需加载，不一次性注入 Agent context

### 导入导出

- **D-27:** Skill 导入/导出采用 ZIP 包格式，包含完整 Skill 包结构：`SKILL.md` + `references/`（源培训文档）+ `scripts/`（辅助脚本）+ `assets/`（模板资源）— 与 agentskills.io 规范兼容

### Claude's Discretion
- SOP 步骤层级的自适应策略（根据材料复杂度决定两层/扁平结构）
- Skill 编辑器的具体 UI 组件选择
- L1 结构检查的具体规则集
- Skill 卡片的信息密度和布局细节
- ZIP 包的内部目录结构
- Alembic migration 的具体字段定义和迁移策略
- 文件树组件的具体实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Framework Skill 模式（核心参考）
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py` — SkillManager 实现：Skill 加载、解析、compose_instructions() 方法。**Phase 19 运行时注入的核心参考**
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/main.py` — Agent 创建流程：Skill 加载 → instructions 组合 → Agent 初始化
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skills/azure-ai-fundamentals-coaching/SKILL.md` — Coaching Skill 范例：YAML frontmatter + Coaching Protocol 格式
- `azure_foundary_hosted_agents-main/coaching-skill-creator/skills/coaching-skill-creator/SKILL.md` — 材料转 Skill 的元技能：5 阶段转换流程（Document Intake → Content Extraction → Learning Design → Skill Assembly → Validation），Phase 19 材料转换核心参考

### Microsoft Agent Framework 官方文档
- `https://learn.microsoft.com/en-us/agent-framework/agents/skills` — Agent Skills 官方文档：Skill 目录结构规范、Progressive Disclosure、Python SDK 接口

### 已有模型和服务（复用模式）
- `backend/app/models/material.py` — TrainingMaterial/MaterialVersion 模型，版本管理模式参考
- `backend/app/services/material_service.py` — 材料上传模式：upload_material() 异步文件处理
- `backend/app/services/agent_sync_service.py` — Agent 同步服务，Skill 注入 Agent instructions 的集成点
- `backend/app/services/prompt_builder.py` — Prompt 构建，Skill SOP 内容注入位置
- `backend/app/models/scoring_rubric.py` — ScoringRubric 模型，L2 评估可参考的维度存储模式
- `backend/app/services/scoring_engine.py` — 评分引擎，L2 AI 评估的 prompt 构造可参考
- `backend/app/models/scenario.py` — Scenario 模型，需新增 skill_id 外键

### 前端模式参考
- `frontend/src/pages/admin/scenarios.tsx` — 卡片网格布局模式，Skill Hub 可参考
- `frontend/src/pages/admin/training-materials.tsx` — 材料上传页面，Skill 材料上传可复用
- `frontend/src/pages/admin/hcp-profile-editor.tsx` — Admin 编辑器模式，Skill 编辑器可参考

### Phase 19 研究
- `.planning/phases/19-ai-coach-skill-module-skill-lifecycle-management-material-to/19-RESEARCH.md` — 技术研究：数据模型、架构模式、依赖库

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TrainingMaterial` 模型 + `material_service.py` — 文件上传/版本管理模式可直接复用
- `prompt_builder.py` — Skill SOP 内容注入 Agent instructions 的集成点
- `scoring_engine.py` — L2 AI 评估的 prompt 构造模式可参考
- `ScoringRubric` 模型 — 维度/权重存储的 JSON 字段模式可参考
- Scenario 卡片页面 — Skill Hub 卡片布局可复用
- react-dropzone — 材料拖放上传已有
- react-hook-form + zod — 表单验证已有

### Established Patterns
- 所有模型使用 TimestampMixin（UUID id + created_at + updated_at）
- 服务层用 async def + db.flush()
- Pydantic v2 schemas with ConfigDict(from_attributes=True)
- TanStack Query hooks per domain
- i18n namespace per module (skill.json)
- Alembic migration with server_default for SQLite compatibility

### Integration Points
- `Scenario` 模型需新增 `skill_id` 外键（可选，nullable）
- `agent_sync_service.py` 需扩展：同步 Agent 时通过 `SkillManager.compose_instructions()` 将关联 Skill 内容注入 Agent instructions
- 参考实现：`azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py`
- Admin 侧边栏导航需新增 "Skill Hub" 入口
- 路由需新增 `/admin/skills`, `/admin/skills/:id/edit`

</code_context>

<specifics>
## Specific Ideas

- 参考 `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/` 的 SKILL.md 规范和 SkillManager 实现
- Skill 内容的 Coaching Protocol 格式参考 `skills/azure-ai-fundamentals-coaching/SKILL.md` — 包含 Capabilities、Protocol Steps、Assessment Rubric 等结构
- AI 反馈式修改：Admin 输入修改意见后 AI 重新生成 SOP，类似 ChatGPT 对话式优化的交互模式
- L2 六维度评估的展示风格与现有 Scoring Rubrics 评分展示保持视觉一致性
- 文件树展示参考 VSCode 资源管理器 — 文件夹可展开/收起，文件图标按类型区分（Markdown/PDF/PPTX/Python）

</specifics>

<deferred>
## Deferred Ideas

- Dry Run 模拟测试（AI 扮演 MR+HCP 自动对话验证 SOP 可执行性）— Phase 20
- Skill 多对多关联 Scenario — 后期扩展
- MR 用户 Skill Hub 浏览视图 — 当前不需要，MR 通过 Scenario 间接使用
- Skill 版本对比/diff 功能 — 后期增强
- 客户预览链接与反馈收集 — 待评估是否纳入本阶段

</deferred>

---

*Phase: 19-ai-coach-skill-module-skill-lifecycle-management-material-to*
*Context gathered: 2026-04-11*
