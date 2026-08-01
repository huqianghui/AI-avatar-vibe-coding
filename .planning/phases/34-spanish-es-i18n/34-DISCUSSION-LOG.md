# Phase 34 Discussion Log

**Date:** 2026-08-01
**Mode:** Interactive discuss → user granted full autonomy mid-session

## Gray Areas Presented

1. 西语翻译的产出与质量
2. Key-parity 校验机制
3. es 语音选择与回退
4. locale 代码与切换器 UX

User selected all four for discussion.

## Q&A Trace

### Area 1: 翻译产出与质量
- **Q: 翻译由谁产出?** → Claude 直接生成（POC 最快，UI 文案质量足够）
- **Q: 风格基准?** → 初答「可以让用户进行选择，这三种」
- **Q (clarify): 三种西语的范围?** → 初选「用户可选语音口音」，随后用户补充推翻：**「如果西班牙语有三套的话，那么ui也显示三套。从ui，翻译，到口语都区分开」** → 最终决策为三套完整 locale（es-ES/es-MX/es-US），UI 翻译 ×3、切换器 5 选项、语音 1:1

### Area 2: Key-parity 校验
- **Q: 机制?** → vitest 全局 parity 测试（遍历全部 namespace，随 npm test / CI）
- **Q: 校验深度?** → 全选：空值检查 + 插值占位符一致 + 未翻译检测（es==en，需白名单）

### Areas 3 & 4: 语音回退 / locale 与切换器
用户离席并授权自主决策（「不要等待我 input 任何东西。你自行决定」）。Claude 决定：
- voice_map 加 es-ES/es-MX/es-US 三 key，预置 Azure 默认音色（Elvira/Dalia/Paloma），未配置回退内置默认、不阻断会话
- 拒答模板补三个 es-* key
- 切换器 5 选项，西语用本地语自称 label
- 浏览器检测 es/未知 es-* 归一到 es-ES；fallback 链 es-* → es-ES → en-US
- mid-session 切语言沿用现有重连行为（成功标准允许 rebuild）

## Standing User Directives (this session)

- 全自主执行 plan → ui-spec → execute → review → verify，loop engineering，不再等待输入
- 每阶段/每需求依次 commit & push 到 GitHub
- 遵循 CLAUDE.md 最高优先级流程：逐需求 + 100% 单测 + Playwright E2E
