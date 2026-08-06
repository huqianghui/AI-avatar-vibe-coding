# Requirements: AI Avatar Platform — Milestone v3.0 Fluent UI v9 Migration

**Defined:** 2026-08-06
**Core Value:** Visitors and logged-in users get instant, accurate, multi-language answers from a digital human grounded in trusted knowledge sources — anonymous users draw from public site content, logged-in users get personalized answers shaped by their own profile and preferences.

> Milestone goal: 将 `@/components/ui/*` 组件库内部实现从 shadcn/Radix+Tailwind 逐个替换为 `@fluentui/react-components` v9（对齐 Azure AI Foundry 门户 / Fluent 2），采用适配器模式——导出名、props 签名、`data-slot` 属性保持稳定，126 个消费文件基本不动，逐组件独立 commit 可单独 revert。
> Research: `.planning/research/SUMMARY.md`（STACK/FEATURES/ARCHITECTURE/PITFALLS，2026-08-06）。详细方案：`.omc/plans/fluent-ui-migration-plan.md`。
> Execution rule (CLAUDE.md top priority): one component at a time → 100% unit test → Playwright E2E → all pass → commit → push.

## v3.0 Requirements

### 基础设施 (INFRA) — Phase 39 (A)

- [ ] **INFRA-01**: 安装 `@fluentui/react-components` (^9.74.4) + `@fluentui/react-icons` (^2.0.334) 与现有 Radix/lucide/sonner 共存，React 18 不升级；Vite `optimizeDeps.include` 两包避免冷启动重优化
- [ ] **INFRA-02**: `App.tsx` 最外层包 `<FluentProvider>`（透明背景 `className="contents"` + transparent，不覆盖 body `bg-background`），theme 通过只读订阅 `useThemeStore()` 从 10 套预生成 theme 中选一套；现有 `.dark`/`.theme-*` class 机制零改动
- [ ] **INFRA-03**: `src/styles/fluent-theme.ts` 提供 `getFluentTheme(mode, accent)`，含 10 套离线预生成 BrandVariants（5 accent × light/dark），缓存进 Map，不在运行时从 CSS 变量计算
- [ ] **INFRA-04**: Griffel 样式插入顺序可控——`index.html` head 内放 `insertionPoint` 锚点 `<style>`，`RendererProvider` + `createDOMRenderer({insertionPoint})` 包裹 FluentProvider，使 Tailwind 布局类在等权重平局中胜出（token 化颜色/边框归 Fluent）；`npm run build` 产物核查插入顺序 + StrictMode 双渲染下渲染器不重复

### 叶子组件适配 (LEAF) — Phase 39 (B)

- [ ] **LEAF-01**: `button` 内部改用 Fluent Button（variant→appearance 映射，destructive 用 Griffel 覆写），保留导出名/props/data-slot；`buttonVariants()` 弱化为兼容导出；`asChild` 用最小 cloneElement 替代
- [ ] **LEAF-02**: `badge`、`separator`(Divider)、`skeleton` 内部替换为 Fluent 等价物，导出面不变
- [ ] **LEAF-03**: `input`、`textarea`、`label` 内部替换为 Fluent 等价物，导出面不变
- [ ] **LEAF-04**: `checkbox`、`switch` 事件签名 shim——`onCheckedChange(bool|"indeterminate")` ↔ Fluent `onChange(ev, data)` `data.checked(bool|"mixed")`，正确映射 shape 与字符串值；保留 data-slot，现有 data-state 断言改 ARIA 等价
- [ ] **LEAF-05**: `progress` 内部替换为 Fluent ProgressBar，适配 0–100 → 0–1 数值刻度（避免静默缩放 bug）；`slider` 单值映射（无双滑块用法）
- [ ] **LEAF-06**: `avatar` 从子节点组合（AvatarImage/AvatarFallback）改造为 Fluent Avatar 的 name/image/initials props，adapter 内 `React.Children` 解析 + 手动重建 broken-image→fallback（onError）

### 复合组件适配 (COMP) — Phase 40 (C1–C8)

- [ ] **COMP-01**: `dialog` — 9 个具名导出保留，映射 Fluent Dialog/DialogSurface/DialogBody，Overlay/Portal 变透明包装；Playwright 验证 Portal 渲染位置/z-index
- [ ] **COMP-02**: `sheet` — 映射 Fluent OverlayDrawer（left/right + **bottom 直接支持**，无需降级）；审计是否有 `defaultOpen` 非受控用法（Fluent 仅受控）
- [ ] **COMP-03**: `select` — 映射 Fluent Dropdown/Combobox，处理 `value` 单值 ↔ `value`(显示文本)+`selectedOptions`(数组)+`onOptionSelect` 三元组差异；`SelectScrollUp/DownButton` 变 no-op 导出；**新写 select.test.tsx（ARIA）并纳入覆盖率**（历史欠账）
- [ ] **COMP-04**: `dropdown-menu` — 映射 Fluent Menu 家族，重点验证 theme-picker.tsx 视觉；**新写 dropdown-menu 测试并纳入覆盖率**（历史欠账）
- [ ] **COMP-05**: `tabs`（TabList/Tab）、`tooltip` 内部替换为 Fluent 等价物，保留导出面与 ARIA 语义
- [ ] **COMP-06**: `card` — 就 Fluent Card（含 selectable-list 语义）vs 保持 plain-div 做 go/no-go 决策后实现，保留导出面
- [ ] **COMP-07**: `form` — 仅换 FormLabel 内部 Label，Slot 用最小 cloneElement 替代；**补齐 form 测试并纳入覆盖率**（历史欠账）
- [ ] **COMP-08**: `scroll-area` **保持 Radix 实现不迁移**（保留自定义滚动条视觉，用户 2026-08-05 决定）；Phase F 清理时保留 `@radix-ui/react-scroll-area` 依赖不卸载

### 图标适配层 (ICON) — Phase 41 (D)

- [ ] **ICON-01**: `makeIconAdapter()` spike 先验证——清空 Fluent icon 硬编码 fontSize，使 Tailwind `size-*` + `currentColor` 生效（像素级 diff 作为批量替换前的硬门禁）
- [ ] **ICON-02**: `src/components/icons/index.ts` 提供 84 个与 lucide 同名的具名导出（regular/filled 映射经人工确认表核对，非脚本瞎猜），保证 tree-shaking
- [ ] **ICON-03**: 130 处 import 按目录分批切换（admin/* → shared/* → voice/* → pages/*），每批独立 commit，build 后对比 bundle size 写入 commit 说明

### Toast 适配层 (TOAST) — Phase 41 (E)

- [ ] **TOAST-01**: toastId 往返 spike 先验证——`src/lib/toast/toast-bridge.ts` 模块级发布订阅总线保留全局单例语义（success/error/info/warning/**loading**/**dismiss(id)**，avatar-page.tsx:224-243 已核实需要），fronting Fluent Toaster + useToastController
- [ ] **TOAST-02**: `components/ui/sonner.tsx` 内容替换为 Fluent Toaster + 消费桥并 re-export `toast`；46 文件按目录分批把 import 从 `"sonner"` 改为 `"@/lib/toast"`，逐文件把 `vi.mock("sonner")` 改为 `vi.mock("@/lib/toast")`（不可批量 sed）；E2E 核查 role="status" live region

### 清理收尾 (CLEAN) — Phase 42 (F, 不可逆)

- [ ] **CLEAN-01**: grep 确认 `@radix-ui`（scroll-area 除外）/`lucide-react`/`sonner`/`vaul` 在 src 零命中（planning 时 + uninstall commit 前各一次），卸载依赖并更新 lockfile
- [ ] **CLEAN-02**: 对照 Foundry 门户截图微调 brand ramp，CSS 变量与 fluent-theme.ts 同步；Lighthouse/a11y 审计不低于迁移前基线
- [ ] **CLEAN-03**: 全量覆盖率 + 全量 E2E 通过；评估将 dropdown-menu/select/form 移出 coverage.exclude 并调高阈值

## Future Requirements

- **CLEANUP-FUTURE**: 清理 v2.3 遗留 tech debt（VoiceLiveInstance 死端点 WR-01、过时测试注释 WR-02、IN-01..03）— 非本 milestone 范围
- **BRAND-01**: 全站 "AI Coach" → "AI Avatar" 品牌文案 — 延续自 v2.3 deferred

## Out of Scope

| Feature | Reason |
|---------|--------|
| scroll-area 迁移到 Fluent | Fluent 无等价物，保留 Radix + 自定义滚动条视觉（用户 2026-08-05 决定） |
| React 18 → 19 升级 | Fluent v9 peer 支持 >=16.14 <20，无需升级，避免额外风险面 |
| 消费组件（业务代码）重写 | 适配器模式核心——导入面稳定，业务代码 cn() 继续做纯 Tailwind 拼接 |
| 全站视觉重设计 | 本 milestone 只换底层实现 + 对齐 Foundry 配色，不改布局/交互 |
| 一次性全量替换 | 违反 CLAUDE.md 逐一实现规则；必须逐组件 commit 以支持单独 revert |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 39 | Pending |
| INFRA-02 | Phase 39 | Pending |
| INFRA-03 | Phase 39 | Pending |
| INFRA-04 | Phase 39 | Pending |
| LEAF-01 | Phase 39 | Pending |
| LEAF-02 | Phase 39 | Pending |
| LEAF-03 | Phase 39 | Pending |
| LEAF-04 | Phase 39 | Pending |
| LEAF-05 | Phase 39 | Pending |
| LEAF-06 | Phase 39 | Pending |
| COMP-01 | Phase 40 | Pending |
| COMP-02 | Phase 40 | Pending |
| COMP-03 | Phase 40 | Pending |
| COMP-04 | Phase 40 | Pending |
| COMP-05 | Phase 40 | Pending |
| COMP-06 | Phase 40 | Pending |
| COMP-07 | Phase 40 | Pending |
| COMP-08 | Phase 40 | Pending |
| ICON-01 | Phase 41 | Pending |
| ICON-02 | Phase 41 | Pending |
| ICON-03 | Phase 41 | Pending |
| TOAST-01 | Phase 41 | Pending |
| TOAST-02 | Phase 41 | Pending |
| CLEAN-01 | Phase 42 | Pending |
| CLEAN-02 | Phase 42 | Pending |
| CLEAN-03 | Phase 42 | Pending |

**Coverage:**
- v3.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-06*
*Last updated: 2026-08-06 — milestone v3.0 requirements defined (Fluent UI v9 Migration, Phases 39–42)*
