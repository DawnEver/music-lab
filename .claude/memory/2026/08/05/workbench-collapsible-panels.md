---
name: workbench-collapsible-panels
description: Workbench restructure — single-page collapsible panels (tuner/pitch/chord/spectrum/settings) with focus-mode route compat, CentsGauge/CollapsibleCard reuse
metadata:
  type: project
---

## 2026-08-05 — 工作台化:单页可折叠面板 + 组件复用

### What changed
- **布局模型**(用户拍板:单页可折叠工作台 + 专注模式;首次访问全部展开):三路由(`/` 工作台、`/tuner`、`/analyzer`)渲染同一 `src/views/Dashboard.vue`,`focus` prop 决定显示子集;专注模式 = 只显示该面板、强制展开、无折叠按钮 — 旧链接兼容。
- **`src/stores/panels.ts`**:折叠状态模块级 reactive + `localStorage["tcl-panels"]` JSON blob 持久化(id 白名单校验、损坏回退默认)。
- **`src/components/CollapsibleCard.vue`**:统一面板外壳(label/title/badge slot/旋转 chevron,`role="button"` + aria-expanded + 键盘);**body 用 `v-if` 卸载 → 折叠即零渲染**:SpectrumCanvas 自动从 spectrumTargets 注销、TunerPanel 的 activateTuner/deactivateTuner 生命周期自动生效(检测音域随面板展开/折叠切换)— 现有响应桥架构零改动就支持了折叠语义。
- **组件复用**:抽 `CentsGauge.vue`(cents 标签 + 原文文本 + 表针内部钳制 ±50)合并 PitchCard 与 TunerBigNeedle 的重复块;五张卡片剥掉外层 section/card-head 外壳,各自内部渲染 CollapsibleCard(focus prop 透传);`components/tuner/TunerView.vue` 改名 `TunerPanel.vue`。
- 导航三 pill(工作台/校音器/分析器);**`/` 链接激活态须手动 `$route.path === '/'` 绑定**(vue-router 前缀匹配会让 `/` 永远 active)。
- 删除 views/TunerView 与 views/AnalyzerView(合并入 Dashboard);路由不再懒加载拆分。

### Validation
- 43 项 Vitest 全绿(本轮无纯逻辑变更);`vue-tsc --noEmit` 干净;生产构建成功;`scripts/smoke.mjs` 重写为工作台断言(5 面板默认展开、折叠卸载 canvas、两个专注模式、工作台返回、语言切换、零 console error),dev 与 preview 双跑通过。

### Reusable insight
- **折叠面板 + v-if 卸载 = 免费的性能与生命周期语义**:只要组件的挂载/卸载钩子已经正确(如 SpectrumCanvas 注销、TunerPanel 音域激活),折叠功能只是包一层 CollapsibleCard,无需任何分析循环改动。
- 折叠状态持久化用单个 JSON blob + id 白名单校验,避免多 key 散落;损坏数据静默回退默认。
- 自绘 CollapsibleCard 而非 v-expansion-panels:保持 lab 视觉、aria 手写(role/tabindex/aria-expanded/键盘)、零样式覆盖成本。
