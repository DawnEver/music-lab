---
name: vue-refactor-and-tuner
description: Full refactor to Vue 3 + Vuetify + Vite + TS + Vitest, multi-instrument per-note tuner added (guitar/bass/ukulele/violin/erhu/guzheng/guqin/blues harp with bends)
metadata:
  type: project
---

## 2026-08-05 — Vue 重构 + 多乐器逐音校音器

### What changed
- **架构**:vanilla JS 单页(零依赖,~3400 行)→ Vue 3 + Vuetify 3 + Vite + TypeScript + Vitest(feat/vue-refactor 分支)。DSP 纯函数原样移植到 `src/lib/`(music-theory/dsp/chord/i18n/draw),控制器分解为 `stores/audio.ts`(reactive 面 + 非响应式音频图)、`lib/analysis-loop.ts`(rAF 循环 + 响应桥)。
- **响应桥设计**(性能关键,后续照此模式):频谱走命令式 canvas(注册到 `spectrumTargets` Set,不进 Vue 响应式);显示结果按分析节奏(~88/105ms)替换 shallowRef;弦列面板用 `tickRef` + 变化才写,21 弦古筝面板保持廉价。
- **检测器参数化**:`PitchRange {minHz,maxHz,minMidi,maxMidi}`,Hz↔MIDI 互相推导,默认 = 旧常量;`analyzeSpectrum` 扫描下限由 minMidi 计算(替换硬编码 48Hz floor,贝斯 B0 必须)。
- **乐器数据层**:`src/instruments/` — 加一种乐器 ≈ 一个数据文件(types.ts 契约)。8 种:吉他(7 调弦)、贝斯(4/5 弦)、尤克里里(re-entrant 物理弦序)、小提琴、二胡、古筝(21 弦公式生成 D/C 调)、古琴(5 调式显式表)、布鲁斯口琴(12 调 + Richter 压音/超吹/超吸能力表)。
- **校音 UX**:自动识别(nearestString/nearestPosition,confidence≥0.35)+ 点选目标 + 大表针;口琴点孔展开压音 1..N/超吹/超吸目标 chips。i18n ~30 新键(zh/en 键集一致由测试强制)。
- **构建/部署**:`vercel.json` → vite framework;README 重写(含"如何添加乐器"文档);产物自包含无运行时 CDN,总 gz ~130KB(懒加载 tuner chunk)。

### 数据修正记录(Plan agent 曾算错,人工验算后修正)
- **古琴**:慢一弦 = 1弦降半音 → **B1(midi 35)**,不是 B0(midi 23);慢三弦 = 3弦降半音 → **E2(midi 40)**,不是 D♯2(midi 39)。五调式表:[36,38,41,43,45,48,50]/[35,…]/[36,38,40,…]/[36,38,41,43,46,48,50]/[36,39,41,43,46,48,50]。
- **口琴 Richter**:吹孔偏移 = 主和弦音程 **[0,4,7,12,16,19,24,28,31,36]**(C: C4 E4 G4 C5 E5 G5 C6 E6 G6 C7),不是混合序列;吸孔 [2,7,11,14,17,21,23,26,29,33]。压音深度:{1:1,2:2,3:3,4:1,5:1,6:2,7:1,8:1,9:1,10:2}(吸),{7:1,8:2,9:1,10:1}(吹);超吹孔 1–6,超吸孔 7–10。
- **口琴 12 调 root = midi 55(G3)..66(F♯4)**,音域 {190–3000 Hz, midi 55–102}(最高 F♯7 2960 Hz);测试曾抓出吉他 range 未覆盖 Drop C/Open G、古筝 C 调 C2 两个真实数据 bug。
- 口琴自动识别优先级:标准 > 压音 > 超吹 > 超吸,再孔号小者(F4 应裁决为 2孔吸压音2 而非 2孔超吹)。

### Validation
- 43 项 Vitest 全绿(算法 + 乐器逐音符/逐孔位);`vue-tsc --noEmit` 干净;生产构建 + 懒加载正常;dev server 全模块冒烟 200。
- 手动浏览器走查(麦克风/文件/各乐器/压音/自动识别/中英切换)与 Vercel 预览部署待用户侧执行。

### Reusable insight
- TS 5.9 下 `Float32Array` 带 `ArrayBufferLike` 泛型 — 声明缓存/结果数组时显式 `Float32Array<ArrayBuffer>` 避免 slice() 赋值报错。
- 版本选型:2026-08 生态最新主版本(Vuetify 4 / router 5 / TS 7 / vite 8)均有未知破坏性变更风险,本项目锁定成熟线:vuetify ^3.13、vue-router ^4.6、ts ~5.9、vite ^7、vitest ^3、vite-plugin-vuetify ^2.1(peer 支持 vuetify ≥3)。
- 低频(30 Hz)下 16384 FFT 单 bin ≈ 160 cents,±32 cents 窗口失去区分度 — 测试频谱 fixture 必须把能量线性摊分到分数 bin 两侧,否则抛物线插值会落在 bin 中心。
- Vuetify 组件默认 chrome 与自绘风格冲突 → token 映射 + style.css 末尾 `.v-*`/自绘覆盖段,实验室视觉(色度条/表针/频谱)保持手绘。
