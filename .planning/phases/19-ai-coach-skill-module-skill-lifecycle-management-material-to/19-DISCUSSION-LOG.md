# Phase 19: AI Avatar Skill Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 19-ai-coach-skill-module-skill-lifecycle-management-material-to
**Areas discussed:** SOP结构格式, 质量门控交互, Skill Hub与管理UI, Skill分配与SOP驱动

---

## SOP 结构格式

| Option | Description | Selected |
|--------|-------------|----------|
| 两层结构（Phase > Step） | 阶段>步骤，简洁遍历方便 | |
| 三层结构 | 模块>阶段>步骤，支持复杂场景 | |
| 扁平列表 | 纯步骤序列，最简单 | |

**User's choice:** 自适应层级 — 根据材料复杂度自动决定，后续修正为对齐 SKILL.md 规范
**Notes:** 用户认为应根据内容复杂度和长短决定

| Option | Description | Selected |
|--------|-------------|----------|
| 完整字段集 | 标题、描述、要点、异议、考核、知识点、时间建议 | ✓ |
| 精简字段集 | 标题、描述、要点、考核 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 完整字段集

| Option | Description | Selected |
|--------|-------------|----------|
| 异步转换+实时状态 | 前端轮询status，大文件不卡UI | ✓ |
| 同步转换+进度条 | 等待完成，显示进度条 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 异步转换+实时状态

| Option | Description | Selected |
|--------|-------------|----------|
| 必须可编辑 | Admin手动调整SOP | |
| 只读展示 | 不满意重新上传 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 双轨编辑 — 手动编辑 + AI反馈式修改（Admin输入修改意见，AI重新生成）
**Notes:** 用户提出可以通过AI方式提出修改意见重新生成

---

## 质量门控交互

| Option | Description | Selected |
|--------|-------------|----------|
| SOP生成后自动触发 | L1即时+L2 Admin手动触发 | ✓ |
| 发布前手动触发 | 减少AI调用成本 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** SOP生成后自动触发

**User's clarification question:** L2 质量评估与 Scoring Rubrics 的关系是什么？
**Claude's explanation:** L2 评估评的是"Skill设计得好不好"（SOP完整性/考核覆盖度等），Scoring Rubrics 评的是"MR做得好不好"（Key Message Delivery/Objection Handling等）。两者独立。

| Option | Description | Selected |
|--------|-------------|----------|
| 雷达图+详情卡片 | 复用已有评分组件，六维雷达图+可展开详情 | ✓ |
| 简单表格 | 六行表格，简洁直接 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 雷达图+详情卡片

| Option | Description | Selected |
|--------|-------------|----------|
| 弹窗确认+原因展示 | 展示低分维度及改进建议 | ✓ |
| 简单确认 | 只显示分数和确认按钮 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 弹窗确认+原因展示

---

## Skill Hub 与管理 UI

| Option | Description | Selected |
|--------|-------------|----------|
| 卡片网格布局 | 类似Scenario选择页 | ✓ |
| 表格布局 | 信息密度高，排序筛选方便 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 卡片网格布局

**User's clarification question:** Skill 和 Scenario 怎么区分？
**Claude's explanation:** Scenario = WHO + WHAT + HOW MUCH（场景环境），Skill = HOW（标准流程/SOP）。训练会话 = Scenario + Skill。

| Option | Description | Selected |
|--------|-------------|----------|
| Skill独立管理+场景关联 | Skill Hub独立，Scenario编辑时关联Skill | ✓ |
| Skill融入Scenario | Skill作为Scenario属性 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** Skill独立管理+场景关联

**User's clarification question:** MR 是否需要看到 Skill Hub？
**User's answer:** 不需要，MR只看到Scenario。
**Decision:** Skill Hub 是纯 Admin 功能

---

## Skill 分配与 SOP 驱动

| Option | Description | Selected |
|--------|-------------|----------|
| Skill分配给Scenario | 一个Scenario关联一个Skill | ✓ |
| Skill直接分配给HCP Agent | 通过SkillAssignment分配 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** Skill分配给Scenario

**User's key input:** 底层使用 Microsoft Agent Framework，原生支持 Skill。参考代码：`azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/`

| Option | Description | Selected |
|--------|-------------|----------|
| 对齐SKILL.md规范 | YAML frontmatter + Markdown body，与Azure Agent Framework兼容 | ✓ |
| 纯JSON结构化 | 结构化强但不直接兼容 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 对齐SKILL.md规范

| Option | Description | Selected |
|--------|-------------|----------|
| 一对一关联 | 一个Scenario关联一个Skill | ✓ |
| 多对多 | 灵活但复杂 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 一对一（后期可扩展为多对多）

---

## Skill 生命周期状态机（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 四态流转 | draft → published → archived + failed | |
| 五态流转（含 review） | draft → review → published → archived + failed | ✓ |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 五态流转（含 review）
**Notes:** review 状态明确表示"待审核"，reject 后回到 draft，编辑已发布 Skill 回到 draft，归档可恢复

---

## Skill 版本管理策略（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 版本化管理 | 编辑已发布 Skill 创建新版本（draft），原版本仍生效，新版本发布后自动替换 | ✓ |
| 简化编辑（回 draft） | 直接修改，状态回 draft，不保留历史版本 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 版本化管理，复用 MaterialVersion 模式

---

## Skill 与 Training Materials 关系（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 独立存储 | Skill 有自己的 SkillMaterial，与 TrainingMaterial 不交叉引用 | ✓ |
| 复用+关联 | 上传到 Skill 的材料同时创建 TrainingMaterial 记录 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 独立存储

---

## 材料转换文件类型（补充讨论）

**User's choice:** PPTX、PDF、DOCX + 所有文本文件（TXT、MD 等）

---

## Skill 运行时注入方式（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 官方 SkillsProvider | 从 DB 加载 → Skill 对象 → SkillsProvider → context_providers 注入 Agent | ✓ |
| 简化 prompt 拼接 | 直接拼入 system prompt | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 官方 SkillsProvider
**User's key input:** 底层使用 Microsoft Agent Framework，有标准接口和模式。参考：https://learn.microsoft.com/en-us/agent-framework/agents/skills
**Notes:** 官方支持 Progressive Disclosure（渐进加载），通过 load_skill/read_skill_resource/run_skill_script 按需加载

---

## Scenario-Skill 关联约束（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 仅关联 published | 编辑时只显示 published Skill，归档后保留关联+警告，删除时置 null | ✓ |
| 严格锁定 | 归档时强制解除关联，无 Skill 则拒绝训练 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 仅关联 published（宽松模式）

---

## Skill Script 管理策略（补充讨论）

| Option | Description | Selected |
|--------|-------------|----------|
| 轻量 Script + Backend 服务 | scripts/ 仅轻逻辑，复杂操作走 Backend API。subprocess + timeout，不需要 Docker | ✓ |
| Docker 隔离执行 | 每个 Skill 的 scripts 通过 Docker container 执行，完全隔离 | |
| 不支持 Script 执行 | Phase 19 暂不实现，scripts/ 仅存储 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 轻量 Script + Backend 服务
**User's key input:** 参考与 ChatGPT 的讨论（https://chatgpt.com/share/69d9cfbc-9018-8321-93a5-385354b6174f）。核心结论：Skill 只做决策层（routing/prompt/decision），执行层独立出去走 Backend Service API
**Notes:** script_runner 用 subprocess + timeout=30s；assets/ 目录存放模板和静态资源，通过 read_skill_resource 按需加载

---

## Code Review 补充讨论（审查修正）

### RESEARCH.md 与 CONTEXT.md 一致性

| Option | Description | Selected |
|--------|-------------|----------|
| 更新 RESEARCH.md | 修正 RESEARCH.md 中与 CONTEXT.md 冲突的内容 | ✓ |
| 保持现状 | 视为不同阶段的参考，不修正 | |

**User's choice:** 更新 RESEARCH.md

### SkillsProvider vs SkillManager

| Option | Description | Selected |
|--------|-------------|----------|
| 直接用 SkillManager | 参考代码已验证，compose_instructions() 更直接稳定 | ✓ |
| 封装 SkillsProvider | 按官方 SDK 接口适配 | |

**User's choice:** 直接用 SkillManager
**Notes:** 参考代码 `skill_manager.py` 已验证可用，SkillsProvider 是更高层抽象但参考代码未使用

### 数据库存储策略

| Option | Description | Selected |
|--------|-------------|----------|
| 拆分存储 | frontmatter→DB字段，body→content Text，resources→SkillResource表 | ✓ |
| 整体存储 | 完整 SKILL.md 存为一个 Text 字段 | |

**User's choice:** 拆分存储

### Alembic Migration 策略

**User's choice:** 留给 Claude's Discretion

### 决策编号重排

**User's choice:** 按主题重新排序所有决策编号（D-01~D-27）

### PDF 解析库

| Option | Description | Selected |
|--------|-------------|----------|
| pdfplumber | 表格支持好，适合培训材料 | ✓ |
| pypdf | 轻量但表格支持差 | |

**User's choice:** pdfplumber

### 转换失败重试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 支持重试 | 基于已上传材料重试，不需重新上传 | ✓ |
| 不支持重试 | 失败后必须重新上传 | |

**User's choice:** 支持重试

### AI Prompt 长文档策略

| Option | Description | Selected |
|--------|-------------|----------|
| 增加分段策略决策 | 格式统一→Markdown→语义+大小切割→逐段提取→合并去重 | ✓ |
| 引用 coaching-skill-creator 即可 | 留给实现阶段 | |

**User's choice:** 增加分段策略决策
**Notes:** 所有格式先转为 Markdown，再按语义和大小考虑切割。Token 上限作为可配置参数，Admin 可调整

### Skill 文件树 UI 展示

| Option | Description | Selected |
|--------|-------------|----------|
| 只读文件树+点击预览 | 类 VSCode 资源管理器，点击叶子节点右侧预览 | ✓ |
| 文件树+可编辑 | 支持拖拽上传和删除 | |
| 简化列表+标签分组 | 按类型分组，不用树形 | |

**User's choice:** 只读文件树+点击预览

---

## Claude's Discretion

- SOP 步骤层级的自适应策略
- Skill 编辑器 UI 组件选择
- L1 结构检查规则集
- Skill 卡片信息密度
- ZIP 包目录结构
- Alembic migration 字段定义和迁移策略
- 文件树组件的具体实现方式

## Deferred Ideas

- Dry Run 模拟测试 — Phase 20
- Skill 多对多关联 — 后期扩展
- MR 用户 Skill Hub 视图 — 不需要
- Skill 版本对比 — 后期增强
- 客户预览链接 — 待评估
