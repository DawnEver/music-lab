---
name: chord-degrees-and-theming
description: Chord Roman-numeral degree labeling with manual/auto key detection (lib/key.ts), full light theme alongside dark (tokens + canvas palettes), native-select dark fix, collapsed-card expand hint
metadata:
  type: project
---

## 2026-08-13 — 和弦级数 + 双主题

### What changed(commits 912e512 / 92ec162 / 1d66d97 / dd0f21c / d585f40 / e8771cf)
- **和弦级数**:`src/lib/key.ts` — `Key = {tonic, mode}` 单一类型,手动选调与自动估调只是同一类型的两个来源。`MODES` 为数据表(major/minor 各 12 个罗马数字标签 + 音级三元组 + variant),符合"加乐器=加数据文件"哲学。`estimateKey` 用 Krumhansl-Schmuckler(24 个调模板 Pearson 相关);`degreeOf` 处理大小写(dim→°/aug→+)、副属和弦 V/x(目标和弦根音下方纯五度为非主音音级)、小调自然/和声变体(V、♯vii°)。`KeyTracker` 滞后切换(challenger 需超 0.04 margin 连续 4 次),镜像 stabilizeChord 的防抖模式。
- **UI**:ChordCard 拆成主音 select(自动估调 + 12 主音)+ 大小调 select(选 mode 即转 manual);级数徽章 调内/离调/副属/和声小调 四态。
- **双主题**:tokens.css 全部中性色 token 化(glass/sheen/well/spotlight/aurora/status-text 等),`:root[data-theme="light"]` 覆盖块;accent 渐变两套主题共享。第一性原理判定:dark 高度=更亮+发光,light 高度=更白+投影;状态文字在浅色填充上必须每主题单独取色。
- **canvas 主题**:canvas 读不了 CSS 变量 → `draw.ts` 里 `SpectrumPalette`(DARK/LIGHT 双 palette)镜像 tokens,按 `documentElement.dataset.theme` 选择;频谱屏 `--screen` token。音高 chip 修复:实线从顶到 chip,虚线从 chip 下方到底,不穿过标签。
- **其他**:原生 select 暗色修复(`color-scheme: dark` + `select option` 显式 bg/color,popup 走系统主题);折叠卡片显示"点击展开"提示(panelExpandHint);主题切换 ThemeToggle + index.html 预渲染脚本防闪烁(localStorage tcl-theme)。

### Validation
- 65 Vitest 全绿(含 key.test.ts 21 项锁定级数/副属/滞后);vue-tsc 干净;smoke 桌面+移动双视口,新增主题切换检查。

### Reusable insight
- 视觉迭代工作流:playwright-core(channel "msedge")截图循环,`page.evaluate` 里直接 `import('/src/lib/...')` 调纯函数造状态;元素级 screenshot + deviceScaleFactor 2 验证 chip 级细节;脚本放项目目录内运行(node 模块解析),跑完即删。
- body 用 background-image 渐变时 computed `backgroundColor` 恒为透明 — 主题断言要打 documentElement。
- 教训:用户否决了"频谱两主题都保持深色"的刻意例外 — "所有组件都要核验",例外必须逐个向用户确认而非自行决定。
- Sharp-review(2026-08-13)发现 4 个 HIGH 未处理:静音后 auto-key 残留、analysis-loop 违反 lib 边界、自动估调开关形同虚设、style.css 1526 行单文件。
