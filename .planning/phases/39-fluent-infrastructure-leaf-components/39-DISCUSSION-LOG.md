# Phase 39: Fluent Infrastructure + Leaf Components - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 39-fluent-infrastructure-leaf-components
**Areas discussed:** 主题 ramp 生成方式, destructive 按钮外观, 零视觉变化验证标准, 叶子组件提交粒度

---

## 主题 ramp 生成方式 (INFRA-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 离线脚本 HSL ramp | 一次性 Node 脚本从 5 hex 算 16 阶写死进 fluent-theme.ts；可复现、锚定品牌色、无外部依赖 | ✓ |
| 微软 Theme Designer 手工 | 官方工具逐个生成 5 套粘回；视觉最准但手工、不可脚本化、工具 URL 未确认 | |
| 你来定（交执行时选） | 先试脚本，不达标再回退 Designer | |

**User's choice:** 离线脚本 HSL ramp
**Notes:** 回退方案（Theme Designer）保留为 D-03，但默认走脚本。

---

## destructive 按钮外观 (LEAF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Griffel 覆写成现有红色 | makeStyles 给 destructive 写红色 token 覆写，视觉零变化 | ✓ |
| 映射到 Fluent appearance | 用现成 appearance 近似，更简单但颜色不一致 | |

**User's choice:** Griffel 覆写成现有红色
**Notes:** 要求红色与当前 danger token 一模一样，不接受近似色。

---

## 零视觉变化验证标准 (INFRA/LEAF)

| Option | Description | Selected |
|--------|-------------|----------|
| 现有套件全绿 + 关键页人工抽查 | vitest+Playwright 全绿作硬门禁（data-slot 保留、data-state 改 ARIA），再人工看关键页 | ✓ |
| 像素级截图 diff | 引入截图基线逐组件对比；最严但需搭视觉回归基建，成本高 | |
| 现有套件全绿即可 | 不做额外人工抽查；最快但可能漏纯视觉回归 | |

**User's choice:** 现有套件全绿 + 关键页人工抽查
**Notes:** 不建像素基线工程（列入 deferred）。人工抽查是全绿后的最后肉眼确认。

---

## 叶子组件提交粒度 (LEAF-01..06)

| Option | Description | Selected |
|--------|-------------|----------|
| 一组件一 commit | 约 12 次 commit，符合 CLAUDE.md 逐一实现，可单独 revert | ✓ |
| 按风险分组 commit | 零风险类似组件打包提交，减少 commit 数，revert 粒度变粗 | |

**User's choice:** 一组件一 commit
**Notes:** 与适配器模式回滚策略一致。button 建议先做以建立范式。

---

## Claude's Discretion

- 离线 HSL ramp 脚本的具体色阶算法（明暗步长、饱和度曲线）
- Griffel insertionPoint / RendererProvider / createDOMRenderer 具体实现写法
- checkbox/switch 事件 shim、asChild cloneElement、avatar children 解析的实现细节
- 12 组件执行顺序（button 先行建立范式）

## Deferred Ideas

- 像素级截图回归基线（独立视觉测试基建）
- Phase 40/41/42 的复合组件、图标层、Toast 桥、依赖卸载
- scroll-area 保持 Radix 不迁移
