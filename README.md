# 调音实验室 · Tuning Lab

> 浏览器内的实时音高/和弦分析 + **多乐器调音器** — 吉他、贝斯、尤克里里、小提琴、二胡、古筝、古琴、布鲁斯口琴(含压音/超吹目标)。Vue 3 + Vuetify 构建,音频只在浏览器本地处理,**不会上传**。
>
> Real-time pitch & chord analysis plus a **multi-instrument per-note tuner** — guitar, bass, ukulele, violin, erhu, guzheng, guqin, and blues harmonica (with bend/overblow targets). Built with Vue 3 + Vuetify; audio never leaves your browser.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#开发)

## 功能 · Features

- 🎙️ 麦克风实时输入,支持切换麦克风设备;或打开本地音频文件分析
- 🎸 **乐器调音**:每种乐器一张弦位/孔位面板,逐音实时显示音准偏差(cent)
  - 吉他(标准 / Drop D / Drop C / DADGAD / Open G / Open D / 半音降调)
  - 贝斯(四弦 / 五弦,含低音 B0)、尤克里里(高 G / Low G)、小提琴、二胡
  - 古筝(21 弦,D 调 / C 调)、古琴(正调 / 慢一弦 / 慢三弦 / 紧五弦 / 紧二五弦)
  - 布鲁斯口琴(12 调性;点孔展开**压音 / 超吹 / 超吸**目标,练习压音时自动识别到具体孔位与压音级数)
  - **自动识别模式**:演奏任意音,自动高亮最近的弦或孔位并跟随显示偏差
  - 点选目标模式:点选弦/孔位/压音位置,大表针跟踪该目标的偏差
- 📊 实时对数频率频谱、主导音高(音名/八度/频率/置信度)、音准偏差表针
- 🎼 和弦识别:大三/小三/减三/增三/sus2/sus4/五度/属七/大七/小七 + 色度能量图;**级数标注**(罗马数字、调内/离调/副属/和声小变体),支持手动选调或 Krumhansl 自动估调
- ⚙️ 可调 A4 基准音、噪声门与识别稳定度
- 🌗 深色 / 浅色双主题,一键切换并记住选择
- 🌐 中英双语界面,一键切换并记住选择;📱 响应式

## 快速开始 · Quick Start

```bash
npm install
npm run dev        # 开发服务器 → http://localhost:5173
npm test           # Vitest 单元测试(43 项:算法 / 乐器数据逐音符校验)
npm run build      # 类型检查 + 生产构建 → dist/
```

> **麦克风需要安全上下文**:请通过 HTTPS 或 `localhost` 访问才能调用麦克风;分析本地音频无此限制。

## 工作原理 · How It Works

- **检测**:`Web Audio API` 16384 点 FFT;`YIN` 时域算法与谐波频谱打分并行,按置信度自动切换(`src/lib/dsp.ts`)。检测音域可按乐器参数化 — 贝斯低至 B0(30.9 Hz),口琴高至 F♯7(2960 Hz)。
- **调音**:弦乐器用 `nearestString` 匹配最近弦;口琴用 `nearestPosition` 匹配全部 (孔×吹吸×压音/超吹/超吸) 位置,并列时按 标准 > 压音 > 超吹 > 超吸、孔号小者优先(`src/instruments/index.ts`)。
- **性能**:频谱绘制走命令式 canvas,不进 Vue 响应式;显示结果按分析节奏(~88–105 ms)以 `shallowRef` 更新;弦列面板变化时才写(`src/lib/analysis-loop.ts`)。
- **国际化**:`src/lib/i18n.ts` 提供 `t()`/`getLang()`/`setLang()`,zh/en 键集一致性由测试强制。

## 添加一种乐器 · Adding an Instrument

架构上,加一种乐器 ≈ 在 `src/instruments/` 加一个数据文件:

```ts
import type { InstrumentDefinition } from "./types.js";

export const myInstrument: InstrumentDefinition = {
  id: "myInstrument",
  name: { zh: "乐器名", en: "Name" },
  category: "strings" | "winds",
  layout: "strings" | "harmonica",   // 通用弦列面板,或自定义面板
  defaultPresetId: "standard",
  range: { minHz: 80, maxHz: 600, minMidi: 30, maxMidi: 72 }, // 检测音域
  presets: [
    { id: "standard", name: { zh: "标准", en: "Standard" }, notes: [40, 45, 50, 55], noteLabels: [...] }
  ]
};
```

然后在 `src/instruments/index.ts` 的 `allInstruments` 里登记即可。测试(`tests/instruments.test.ts`)自动校验:所有音符落在该乐器音域内、预设 id 唯一、默认调式存在。

## 项目结构 · Structure

```
tone-chord-lab/
├── index.html              # Vite 入口
├── vite.config.ts          # vue + vuetify 插件、base './'、vitest 配置
├── public/                 # favicon.ico / favicon.png
├── src/
│   ├── main.ts             # 入口:router + vuetify + window.ToneChordLab 兼容 API
│   ├── App.vue             # AppShell(顶栏 / 导航 / 页脚)
│   ├── lib/                # 框架无关纯模块
│   │   ├── music-theory.ts dsp.ts chord.ts key.ts i18n.ts draw.ts
│   │   ├── analysis-loop.ts # rAF 分析循环 + Vue 响应桥
│   │   └── format.ts
│   ├── instruments/        # 乐器数据层(types / 注册表 / 8 个数据文件)
│   ├── stores/audio.ts     # 音频会话 store(reactive 面 + 非响应式音频图)
│   ├── composables/        # useAudio / useAnalysis / useI18n / useTheme / useToast / useTuner
│   ├── styles/             # tokens.css(深/浅双主题变量)+ style.css
│   ├── components/         # AppShell / SourceBar / 各卡片 / tuner/ 面板
│   └── views/              # AnalyzerView / TunerView(懒加载路由)
├── tests/                  # Vitest:算法 + 乐器数据逐音符校验
└── vercel.json
```

## 测试 · Tests

```bash
npm test        # Vitest 单元测试
npm run smoke   # Playwright 冒烟(桌面+移动视口:布局、折叠、主题切换)
```

覆盖:YIN 音高检测(含 B0/D6/A6 宽音域)、合成频谱主导音与色度、和弦识别、级数标注(C 大调/A 小调各级、副属 V/x、KeyTracker 滞后)、i18n 键集一致性、乐器数据逐音符/逐孔位断言(吉他 E2–E4、古筝 21 弦、古琴五调式、口琴 C/G 调与压音表、F4 优先级裁决)。

## 部署 · Deployment

Vercel 直接导入仓库即可(已配置 `vercel.json` 为 Vite 框架),或:

```bash
npm run build && vercel
```

## 附注 · Notes

- **八度命名**:采用严格科学音高记谱(SPN),midi 23 显示为 B0(五弦贝斯低音弦常称 B1,同音高)。
- **乐器调音**:一次只演奏一个音;扫弦/和弦输入会交给和弦识别,调音器按主音处理。
- **古琴调式**:默认十二平均律;古琴传统用纯律/五度相生调弦,偏差通常小于 5 cent,后续可扩展律制支持。
- 产物自包含、无运行时 CDN;依赖仅 `vue` / `vue-router` / `vuetify` / `@mdi/font`。

## 许可证 · License

[MIT](LICENSE)
