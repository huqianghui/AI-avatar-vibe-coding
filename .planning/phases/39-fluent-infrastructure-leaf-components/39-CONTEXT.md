# Phase 39: Fluent Infrastructure + Leaf Components - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

安装 `@fluentui/react-components` v9 与 `@fluentui/react-icons`（与 Radix/lucide/sonner 共存），在 `App.tsx` 挂载 `<FluentProvider>` 并建立 Griffel/Tailwind 主题桥（10 套预生成 theme = 5 accent × light/dark），再把 12 个低风险叶子组件（button/badge/input/label/checkbox/switch/separator/skeleton/progress/textarea/slider/avatar）的内部实现换成 Fluent，保持导出名/props/data-slot 稳定。目标：零视觉变化，并建立 Phase 40 复合组件复用的适配范式。

覆盖需求：INFRA-01..04、LEAF-01..06。复合组件（dialog/sheet/select 等）、图标层、Toast 桥、依赖卸载均为后续 phase（40/41/42），不在本 phase。
</domain>

<decisions>
## Implementation Decisions

### 主题 ramp 生成方式 (INFRA-03)
- **D-01:** 用**离线 Node 脚本从 5 个锚定 accent hex 计算 HSL ramp**，生成每个 accent 的 16 阶 BrandVariants，写死进 `src/styles/fluent-theme.ts`。锚定色：Blue `#1E40AF`(BeiGene Blue，默认)、Teal `#0D9488`、Purple `#7C3AED`、Rose `#BE185D`、Amber `#B45309`（来源 `frontend/src/stores/theme-store.ts` ACCENT_COLORS）。
- **D-02:** ramp 结果写死为静态数据（缓存进 Map），**不在运行时从 CSS 变量计算**。脚本可重复运行、锚定现有品牌色、不依赖外部工具（微软 Theme Designer URL 研究时未能确认可用）。
- **D-03:** 若离线脚本生成的感知色阶视觉不达标，回退方案是微软 Theme Designer 手工生成——但默认走脚本，不先跑 Designer。

### destructive 按钮外观 (LEAF-01)
- **D-04:** Fluent 无内置 danger appearance——destructive variant 用 **Griffel `makeStyles` 覆写成现有红色 token**，保持与当前 danger 色阶一致，视觉零变化。不降级到 Fluent 现成 appearance（primary/outline）近似。

### 零视觉变化验证标准 (INFRA/LEAF 全部)
- **D-05:** 验证 = **现有 vitest + Playwright 全套通过（硬门禁）+ 关键页人工抽查**。不引入像素级截图基线（那本身是独立工程，Phase 39 内成本过高）。
- **D-06:** 测试适配：`data-slot` 选择器必须保留（约 39 处测试依赖）；现有 Radix `data-state` 断言改写为 ARIA 等价断言（如 checkbox.test.tsx）。全绿后再人工看几个关键页确认颜色/间距无肉眼回归。

### 叶子组件提交粒度 (LEAF-01..06)
- **D-07:** **一组件一 commit**（约 12 次），严格遵循 CLAUDE.md 逐一实现规则（实现 → 100% unit test → E2E → 全绿 → commit → push）。任一组件出问题可单独 `git revert`，与适配器模式的回滚策略一致。不按低风险分组打包提交。

### Claude's Discretion
- 离线 HSL ramp 脚本的具体色阶算法（明暗步长、饱和度曲线）——只要锚定 5 个 hex 且明暗两套合法即可。
- Griffel `insertionPoint` 锚点元素在 index.html head 的具体写法、RendererProvider/createDOMRenderer 的模块级构造细节（研究已定方向，实现细节交给 planner/executor）。
- checkbox/switch 事件签名 shim、asChild cloneElement 替代、avatar children 解析的具体实现写法。
- 12 个叶子组件的执行顺序（哪个先做）——建立范式的组件（button）建议先行。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 迁移方案与研究
- `.omc/plans/fluent-ui-migration-plan.md` — 完整 A–F 迁移方案，含已核实风险点、组件清单、Phase A/B 范围
- `.planning/research/SUMMARY.md` — 综合研究（stack/features/architecture/pitfalls 综述）
- `.planning/research/STACK.md` — 精确包版本（@fluentui/react-components ^9.74.4、@fluentui/react-icons ^2.0.334）、Griffel/Tailwind 插入顺序源码级分析、Vite optimizeDeps、"不要装"清单
- `.planning/research/ARCHITECTURE.md` — FluentProvider 放置、fluent-theme.ts 主题桥、Griffel insertionPoint + RendererProvider + createDOMRenderer 具体设置、cn()/mergeClasses 共存、build order
- `.planning/research/FEATURES.md` — 逐组件 Radix→Fluent v9 映射（12 叶子 + 9 复合的 API 差异，含 checkbox/switch 事件签名、ProgressBar 0–1 刻度、avatar children 解析）
- `.planning/research/PITFALLS.md` — 21 条迁移陷阱 + 按 phase 映射的防护措施（Griffel/Tailwind 顺序、StrictMode、icon fontSize、data-state 爆炸半径）

### 现有代码
- `frontend/src/stores/theme-store.ts` — 5 accent + light/dark 主题机制（ACCENT_COLORS 锚定 hex，.dark/.theme-* class），主题桥必须只读订阅、零改动
- `frontend/src/styles/index.css` — Tailwind v4 @theme inline CSS 变量（品牌色阶单一真源）
- `frontend/src/App.tsx` — provider 树（FluentProvider 挂载点）
- `frontend/index.html` — Griffel insertionPoint 锚点插入位置
- `frontend/src/lib/utils.ts` — cn()（业务代码继续用，ui 内部改 mergeClasses）
- `frontend/src/components/ui/index.ts` — 24 组件桶导出（导出面必须稳定）

### 项目规约
- `CLAUDE.md` — 最高优先级逐一实现规则（逐组件 → 100% unit test → E2E → commit → push）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `theme-store.ts` ACCENT_COLORS：5 个 accent 的锚定 hex + label，直接作为 HSL ramp 脚本输入
- 现有 12 叶子组件均有 `data-slot` 属性 + 多数有 `*.test.tsx`（button/badge/input/label/checkbox/switch/separator/skeleton/progress/textarea/slider/avatar；已见 checkbox/progress/separator/skeleton 测试文件）
- `cn()`（clsx + tailwind-merge）：业务代码继续用；ui 内部改用 Griffel mergeClasses，consumer className 拼在 Griffel 类之后

### Established Patterns
- 主题机制：useSyncExternalStore + document.documentElement.classList（.dark + .theme-{accent}），accent !== "blue" 时加 theme-* class；FluentProvider 只读订阅，不改这套
- Tailwind v4 @theme inline CSS 变量是品牌色单一真源；Fluent theme 从同一批 accent hex 单向映射
- 组件测试用 data-slot 选择器 + Radix data-state 断言（后者需改 ARIA）

### Integration Points
- `App.tsx`：FluentProvider 包最外层（透明背景 className="contents"，不覆盖 body bg-background），RendererProvider + createDOMRenderer 包在其外
- `index.html` head：Griffel insertionPoint 锚点 `<style>`，须在 Tailwind 注入样式表之前
- `src/styles/fluent-theme.ts`（新增）：getFluentTheme(mode, accent) + 10 套预生成 BrandVariants
</code_context>

<specifics>
## Specific Ideas

- 主题桥必须"零改动"现有 theme-store：FluentProvider 是纯只读订阅者，把 store 的 (mode, accent) 翻译成 10 套缓存 theme 之一，`.dark`/`.theme-*` class 机制完全不动。
- destructive 按钮的红色要跟当前一模一样——用 Griffel 覆写锚定现有 danger token，不接受"近似色"。
- 验证优先靠现有自动化套件（快、可复现），人工抽查只是最后一道肉眼确认，不建视觉基线工程。
</specifics>

<deferred>
## Deferred Ideas

- 像素级截图回归基线 — 更适合作为独立的视觉测试基建，不在 Phase 39（若后续 phase 需要可单列）
- 复合组件（dialog/sheet/select/dropdown-menu/tabs/tooltip/card/form）迁移 — Phase 40
- 图标适配层 + Toast 桥 — Phase 41
- 卸载 Radix/lucide/sonner/vaul + Foundry 配色微调 — Phase 42（不可逆，go/no-go）
- scroll-area 保持 Radix 不迁移 — 全程保留（Phase 42 也不卸载其 Radix 依赖）

</deferred>

---

*Phase: 39-fluent-infrastructure-leaf-components*
*Context gathered: 2026-08-06*
