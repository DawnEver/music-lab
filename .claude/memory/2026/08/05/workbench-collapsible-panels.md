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

## 2026-08-05 (迭代 2)— 校音器横向伸展 + 单界面 + 样式统一

### What changed(用户反馈驱动)
- **单界面**:删除 `/tuner`、`/analyzer` 路由(redirect 到 `/`),导航完全移除(顶栏只留品牌 + 音频源控件);CollapsibleCard/各卡片删除 focus prop 与专注模式逻辑。
- **校音器横向伸展**:`.tuner-card { grid-column: 1 / -1 }` 跨满 dashboard 两列(否则被 `minmax(0,1.05fr) minmax(0,0.95fr)` 网格压到 ~600px 窄列 — 这是"为什么没横排"的根因);内部 `.tuner-main` 网格 `minmax(260px,360px) 1fr`(大表针左、弦列/口琴右),≤900px 回退单列;`StringsPanel` 从竖排 rows 改 `repeat(auto-fill, minmax(150px,1fr))` 自适应网格卡片(两行结构:string-top = label+note、string-bottom = cents+status)。
- **样式统一**:`.card` padding 统一 22px(metric 26/spectrum 24/control 20 收敛);`.panel-body { flex column; gap: 16px }` 统一内容间距;`.tuner-big` 移除独特大渐变 → 与弦列卡同语言表面(rgba(148,163,184,0.05) + var(--line) 边框)。

### Validation(含用户要求的 mobile/desktop 兼容性)
- `scripts/smoke.mjs` 改为**双视口**(1280×900 桌面 + 375×667 移动)各跑完整工作台走查:5 面板渲染/折叠卸载 canvas/吉他 6 卡横排(几何断言 card0.y===card1.y)/二胡 2 卡/口琴 20 cell + 位置 chips/**无横向溢出**(scrollWidth<=innerWidth)/桌面 needle 在左与面板同行、移动回退单列(几何断言)/语言切换后 h1=Tuning Lab/零 console error — dev 与生产 preview 双跑通过。
- 43 项 Vitest、vue-tsc、build 全绿。

### Reusable insight(本迭代)
- **"为什么没横排"的排查路径**:父级 `.dashboard` 网格把卡片压进窄列 — 全宽诉求先检查 grid 父容器,`.tuner-card` 这类"横向伸展"面板需要 `grid-column: 1 / -1`。
- 移动兼容性验证不要只看"能渲染" — 用几何断言(同 y = 同行、needle 上方 = 单列)+ scrollWidth 溢出检查,两个都进冒烟脚本,以后每次 UI 改动自动回归。
