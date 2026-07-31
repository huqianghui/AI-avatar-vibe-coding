# Quick Task 260731-q3c: 统一项目名称 AI-Coach-vibe-coding → AI-avatar-vibe-coding - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Task Boundary

将项目从 "AI-Coach-vibe-coding" 统一重命名为 "AI-avatar-vibe-coding"，更新项目名称、文档中的项目标识，为后续 avatar 新功能开发做准备。

项目目录已经是 `/Users/huqianghui/Downloads/1.github/AI-avatar-vibe-coding`（从 AI-Coach-vibe-coding 拷贝而来），但仓库内部所有引用仍指向旧名称。

</domain>

<decisions>
## Implementation Decisions

### 产品显示名称
- 新产品名：**AI Avatar Platform**
- 用于 README 标题、UI 页面标题（frontend/index.html）、文档中的产品名
- 去掉 "AI Coach Platform — BeiGene" 的 Coach 培训定位

### 历史规划文件（.planning/）
- **全部替换**：所有 .planning/ 下的文件中 "AI-Coach-vibe-coding" → "AI-avatar-vibe-coding"，"AI Coach" 产品名 → "AI Avatar Platform"（路径引用必须替换；叙述性文字中的旧路径也替换）

### 文档定位描述改写
- CLAUDE.md / README.md / .planning/PROJECT.md 中的产品定位描述**一并改写**为新的 avatar 产品定位。
- 新定位要点（来自客户新需求）：
  1. **匿名模式（不需登录）**：数字人 avatar 基于官方网站内容/知识回答问题（知识进入 Foundry IQ）
  2. **登录模式（个性化）**：基于 CRM 知识的个性化 avatar（POC 用 Excel 对应关系表，不做 CRM 集成）；记住 user profile 与偏好（按 userid 注入偏好，通过 system prompt / prompt template injection）；memory 由后台抽取用户偏好或人工打标签（POC 不做深入 memory 机制）
  3. **多语言**：西班牙语支持（在现有中/英基础上）
  4. **UI**：清爽展示，只显示数字人 + 文档链接信息；数字人语音内容与文档展示分离（source: page + document link）
  5. 仍基于 Azure PaaS（Azure OpenAI、Speech、Avatar、Foundry）

### 必须修复（技术性）
- `.claude/` GSD 工具链中硬编码的绝对路径 `/Users/huqianghui/Downloads/1.github/AI-Coach-vibe-coding/...` → `/Users/huqianghui/Downloads/1.github/AI-avatar-vibe-coding/...`（否则 GSD 命令会读取旧目录 — 旧目录仍存在于磁盘上，风险很高）
- frontend/package.json name、backend/pyproject.toml name、infra/azure 配置中的名称
- frontend theme-store 中的 localStorage key（如 ai-coach-theme）可一并改名（POC，无需兼容旧 key）

### Claude's Discretion
- 排除目录：node_modules、.venv、.omc、frontend/.nyc_output（生成物）、package-lock.json 中的 name 字段需与 package.json 同步（可通过 npm install 再生成或直接编辑 name 字段）
- 二进制/加密文件（.pen 等）不处理
- git remote URL 不在本任务范围（用户自行管理）
- 代码内部标识（如 Python 包名 app、API 路径）不涉及旧名称的不改动

</decisions>

<specifics>
## Specific Ideas

- 扫描结果：约 359 个文本文件包含 "AI-Coach"（排除 node_modules/.venv/.omc/.nyc_output/package-lock 后约 300 个），主要分布：
  - `.claude/commands/gsd/*.md`、`.claude/get-shit-done/**/*.md`、`.claude/agents/*.md`、`.claude/settings.local.json`（硬编码绝对路径）
  - `.planning/**`（历史 PLAN/SUMMARY/PROJECT.md 等）
  - `README.md`、`CLAUDE.md`、`wiki/*.md`、`infra/azure/**`
  - `frontend/index.html`、`frontend/package.json`、`frontend/src/stores/theme-store.ts(.test.ts)`
  - `backend/pyproject.toml`、`backend/app/api/internal_openai_proxy.py`、`backend/app/services/prompt_optimizer_client.py`、`backend/app/services/meta_skill_templates/**`
  - `.continue-here.md`
- 批量替换建议用脚本（如 `git ls-files | xargs grep -l ... | xargs sed -i ''`）完成机械替换，再对 CLAUDE.md/README/PROJECT.md 做人工定位描述改写
- 替换后需验证：`grep -r "AI-Coach" 排除生成物后为 0`；后端 `ruff check` + `pytest` 冒烟；前端 `tsc -b` + `npm run build`

</specifics>

<canonical_refs>
## Canonical References

无外部 spec — 需求完全来自本次对话中用户提供的客户新需求（MVP Scoping）。

</canonical_refs>
