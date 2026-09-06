# 音乐实验室 · Music Lab

> 浏览器内的音乐练习工具台:**调音** + **声图** + **专业节拍器** + **视唱练耳** + **演奏**。实时音高/和弦分析 + 多乐器调音器 — 吉他、贝斯、尤克里里、小提琴、二胡、古筝、古琴、布鲁斯口琴(含压音/超吹目标)。Vue 3 + Vuetify 构建,音频只在浏览器本地处理,**不会上传**。
>
> A browser music-practice workbench: **tuning**, a **trace** for looking at sound over time, a **professional metronome**, **ear training with sight-singing**, and a **play** tool for keys, frets, pads and fingering charts. Real-time pitch & chord analysis, a multi-instrument per-note tuner — guitar, bass, ukulele, violin, erhu, guzheng, guqin, and blues harmonica (with bend/overblow targets). Built with Vue 3 + Vuetify; audio never leaves your browser.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#开发)

**Online:** [music.mingyangbao.site](https://music.mingyangbao.site) · **Source:** [github.com/DawnEver/music-lab](https://github.com/DawnEver/music-lab)

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
- 🥁 **节拍器**(`/rhythm`):Web Audio 时钟调度,不受主线程抖动影响
  - **改动即时生效**:速度 / 细分 / Swing / 重音 / 复节奏在**下一个点**就变(≤ 100ms 调度视野),只有拍号等到小节线 — 因为小节中途改变小节长度会打乱数拍
  - **单屏无面板**:拍点、速度、启停常驻不滚动;**读数即控件** — BPM 可直接输入数字(± / ↑↓ 微调、Tap 取速),点 `4/4`、`八分`、`音色`、`练习模式` 就地展开各自编辑器(桌面浮层 / 移动端底部抽屉),空格键启停
  - **加法拍号模型**:拍号即分组 — 4/4、3/4、6/8 [3+3]、9/8、12/8、5/8 [2+3 / 3+2]、7/8 [2+2+3 / 2+3+2 / 3+2+2]、11/8 [3+3+3+2]、16 分母混合拍,支持自定义分组(如 `3+2+2`)
  - **可编辑重音**:每个拍点在 强 / 次强 / 弱 / 静音 之间循环,分组首拍自动带次强
  - **细分**:基本拍 / 八分 / 三连音 / 十六分 / 五连音 / 六连音 / 七连音
  - **Swing**:在时间层实现,0% 平均 → 100% 三连音摇摆
  - **复节奏**:2/3/4/5/7 均分小节的第二声部(3:2、4:3、5:4 …)
  - **练习模式**:渐进提速(每 N 小节 +X BPM,带上限)、静音小节循环、随机静音
  - 打拍取速(Tap)、六种音色(合成 / 电子 / 木鱼 / 响棒 / 牛铃 / 踩镲)、音量与设置持久化
- 📈 **声图**(`/trace`):时频图 + 音高曲线两个图层叠在同一时间轴上
  - x 轴时间、y 轴频率、颜色是能量;色标本身就是 dB 轴(可调下限/上限),五种感知均匀配色
  - 纵轴可切**对数 Hz** 或**半音**(半音刻度下"高半音"处处等距,视唱最需要)
  - 时间窗口 2/5/10/30 秒随选随缩放;**冻结**后可拖动回看刚才唱的那一句;悬停读出时间/音名/频率/电平
  - **瞬时谱**(原调音页的实时频谱)并入同一页,与时频图共用一次输入
  - 桌面把图层、纵轴、窗口、分辨率、配色、dB 上下限、参考音**全部平铺**在画布下方;手机收进抽屉
  - 时间/频率分辨率可选(短窗时间锐利 ↔ 长窗频率锐利),参考音一条横线 + 可选 2×/3×/4× 泛音辅助线
  - 音高曲线在换气处断开(不画出没唱过的滑音),并纠正一帧的八度误判;take 结束给出**音域**
- 👂 **视唱练耳**(`/ear`):听辨 + 视唱一处完成,全流程自动连续
  - 音程 / 和弦性质 / 音阶听辨:出题、发声、作答、判分、记录一条闭环;**答完自动进下一题**(数字键作答,可关自动)
  - **出题不重样**:拒绝连续重复,并让最近做错的题更早回来
  - **难度自适应**:按最近 20 次正确率升降级(>85% 升,<60% 降),答案键盘顺序固定
  - **视唱**:**看谱唱** —— 自绘**五线谱**(谱号 / 调号 / 拍号 / 加线 / 符干)或**简谱**(`1 = C` + 级数 + 八度点),不引音乐字体
  - 一个按钮跑完整个循环:给主音 → 预备拍 → 唱 → 逐音判分 → 自动换下一条;唱时光标沿谱移动,判分后每个音染上自己的颜色
  - **音域可选**(`原调 / 低八度`):男声低八度唱是对的 —— 发声、画线、判分都跟着音域走,谱面不动只标 `8vb`
  - 起音滑音与"晚起一点"被排除在判分之外;调 / 速度 / 小节可选;进度可重置
  - app 自己发声时(参考音 / 预备拍 / 试听)暂停采集,不会把自己的声音录进你的 take
- 🎹 **演奏**(`/play`):同一个工具,四种演奏面 —— 乐器自己决定画什么、响什么
  - **键盘**:钢琴 / 电钢琴 / 风琴;鼠标、触摸、电脑键盘(Z–M 与 Q–P 两排)与八度切换
  - **指板**:吉他 / 贝斯 / 尤克里里 / 曼陀林 / 班卓 / 琵琶 / 阮 / 柳琴 —— 每一品就是一个半音,**调弦数据直接生成指板**,Drop D、DADGAD、七弦全部免费
  - **鼓垫**:架子鼓九件,闭镲与开镲互相**掐断**(choke group)
  - **音孔图**:笛 / 箫 / 萨克斯 —— 调音页画的那张指法图,按住就吹响
  - 音色全部为合成:包络与滤波决定音色,不是波形 —— 槌击弦会随衰减变暗,风琴不衰减,吹管带气声噪声层
- 🌗 深色 / 浅色双主题,一键切换并记住选择
- 🌐 中英双语界面,一键切换并记住选择;📱 响应式

## 快速开始 · Quick Start

```bash
npm install
npm run dev        # 开发服务器 → http://localhost:5173
npm test           # Vitest 单元测试(算法 / 乐器数据 / 节拍器领域与调度 / 演奏)
npm run build      # 类型检查 + 生产构建 → dist/
```

> **麦克风需要安全上下文**:请通过 HTTPS 或 `localhost` 访问才能调用麦克风;分析本地音频无此限制。

## 工作原理 · How It Works

- **检测**:`Web Audio API` 16384 点 FFT;`YIN` 时域算法与谐波频谱打分并行,按置信度自动切换(`src/lib/dsp.ts`)。检测音域可按乐器参数化 — 贝斯低至 B0(30.9 Hz),口琴高至 F♯7(2960 Hz)。
- **调音**:弦乐器用 `nearestString` 匹配最近弦;口琴用 `nearestPosition` 匹配全部 (孔×吹吸×压音/超吹/超吸) 位置,并列时按 标准 > 压音 > 超吹 > 超吸、孔号小者优先(`src/instruments/index.ts`)。
- **一条时间线**:所有时间戳都来自 `AudioContext.currentTime` — 频谱列、检测音高、节拍点、答题时刻。写的旋律与唱的曲线因此天然对齐,视唱评分不需要任何对齐代码。
- **输入是应用级会话**:麦克风只选一次,各工具各自挂 tap(`src/audio/capture.ts`)。调音用 16384 点长窗(频率锐利),观察用短窗且关闭平滑(时间锐利)——同一个 analyser 无法兼顾。
- **性能**:canvas 通过 `onFrame` 命令式绘制,不进 Vue 响应式;显示结果按分析节奏(~88–105 ms)以 `shallowRef` 更新;时频图保留的是带音频时间戳的列环形缓冲,视图是对它的一次查询,而不是逐帧滚动画布(`src/audio/analysis.ts`、`src/lib/spectrogram.ts`)。
- **国际化**:`src/lib/i18n.ts` 提供 `t()`/`getLang()`/`setLang()`,zh/en 键集一致性由测试强制。

## 添加一种乐器 · Adding an Instrument

一件乐器 = **身份** + 若干**能力**,每种能力都是可选的。钢琴没有玩家会去设的调弦,架子鼓根本没有音高 —— 把三者塞进同一个形状,抽象就不再约束任何东西。

```ts
import type { InstrumentDefinition } from "./types.js";

export const myInstrument = {
  id: "myInstrument",
  name: { zh: "乐器名", en: "Name" },
  category: "plucked",              // keys | plucked | bowed | winds | percussion | other

  // 能力一:可调音 —— 出现在 /tune 里。省略则不出现。
  tuning: {
    layout: "list",                 // list | grid | fingering
    defaultPresetId: "standard",
    presets: [
      { id: "standard", name: { zh: "标准", en: "Standard" }, notes: [40, 45, 50, 55] }
    ]
    // range 通常省略:deriveRange() 从乐器能发出的所有音推导,不会与数据脱节
  },

  // 能力二:可演奏 —— 出现在 /play 里。surface 决定画什么,timbre 决定响什么。
  timbre: "nylon",
  surface: { kind: "frets", frets: 15 }
} satisfies InstrumentDefinition;
```

`surface` 的四种形态:

| kind | 画成 | 音高从哪来 |
|---|---|---|
| `keys` | 钢琴键 | 键盘映射 + 八度 |
| `frets` | 指板 | `tuning.presets` 的空弦 + 品位算术 |
| `holes` | 指法图 | `tuning.presets` 的 `fingerings`(所以必须同时可调音) |
| `pads` | 鼓垫 | **没有音高** —— 每个 piece 自带 `timbre` 与 Hz |

音色同样是数据(`src/audio/timbre.ts`),加一种音色是加一行:

```ts
{ id: "nylon", waveform: "triangle", gain: 0.3, attack: 0.008, ring: 2.6,
  partials: [0.42, 0.18, 0.09, 0.04],
  filter: { type: "lowpass", harmonic: 4, q: 0.7, envelope: 2.5 } }
```

然后在 `src/instruments/index.ts` 的 `allInstruments` 里登记。测试(`tests/instruments.test.ts`)自动校验:每件乐器至少声明一种能力、音符全部落在推导出的检测音域内、预设 id 唯一、有演奏面的必须有声音(鼓例外 —— 它的声音在每个 piece 上)。

## 项目结构 · Structure

```
music-lab/
├── index.html              # Vite 入口
├── vite.config.ts          # vue + vuetify 插件、根路径部署、vitest 配置
├── public/                 # favicon.ico / favicon.png
├── src/
│   ├── main.ts             # 入口:router + vuetify + window.MusicLab 兼容 API
│   ├── App.vue             # AppShell(顶栏 / 工具导航 / 页脚)
│   ├── audio/              # 唯一接触 Web Audio 的层
│   │   ├── context.ts      # 租约式获取:最后一个租约释放才关闭 context
│   │   ├── source.ts       # 应用级输入会话(mic / file)+ tap 注册
│   │   ├── capture.ts      # 按需的 analyser tap(每个视图自己的时频取舍)
│   │   ├── analysis.ts     # 分析流:帧 → 特征(shallowRef)+ onFrame 订阅
│   │   ├── history.ts      # 时频列环形缓冲(音频时基,30 Hz)
│   │   ├── transport.ts    # Transport 接口 + 原生实现
│   │   ├── scheduler.ts    # 前瞻调度器(对事件泛型)
│   │   └── voice.ts        # 全应用唯一的合成器(音色即数据)
│   ├── lib/                # 框架无关纯模块
│   │   ├── music-theory.ts dsp.ts chord.ts key.ts interval.ts i18n/
│   │   ├── spectrogram.ts pitch-track.ts colormap.ts notation.ts(五线谱/简谱布局)
│   │   ├── plot/           # scale / palette / canvas / spectrum / trace(唯一的刻度真相)
│   │   └── format.ts
│   │   └── timbre.ts       # 音色即数据(键盘 / 拨弦 / 打击 / 吹管家族)
│   ├── instruments/        # 乐器数据层(types / 注册表 / 每件乐器一个数据文件)
│   ├── features/
│   │   ├── tuning/         # 调音与分析工具
│   │   │   ├── components/ # 各分析卡片 / tuner 面板
│   │   │   ├── stores/      # 输入会话 / 状态 / 设备发现
│   │   │   ├── composables/ # 调音专用状态与生命周期
│   │   │   └── TuningView.vue
│   │   ├── trace/          # 声图(时频图 + 音高曲线 + 瞬时谱)
│   │   ├── ear/            # 练耳与视唱(domain 出题/判分 → engine 发声 → stores → UI)
│   │   ├── play/           # 演奏台(keymap/指板/音孔 domain → performer → stores → UI)
│   │   └── metronome/
│   │       ├── domain/     # meter / accent / tempo / rhythm / practice / presets(纯函数)
│   │       ├── engine/     # transport 接口 + native-transport / scheduler / bar-cursor / click-engine / sound-bank
│   │       ├── stores/     # metronome.ts(响应式状态 ↔ transport 接线)
│   │       ├── components/ # Transport / Tempo / Meter / BeatGrid / Subdivision / Practice / Sound
│   │       └── MetronomeView.vue
│   ├── shared/             # 跨工具复用:AppShell / ToolNav / AudioSource(输入控件) / TracePlot(时间视图) / CollapsibleCard
│   ├── composables/        # 跨工具的 useAnalysis / useI18n / useTheme / useToast
│   ├── styles/             # tokens.css(深/浅双主题变量)+ style.css
│   └── router/             # /tune、/trace、/rhythm、/ear(懒加载;旧路径全部重定向)
├── tests/                  # Vitest:算法 + 乐器数据 + 节拍器领域/调度
└── vercel.json
```

架构只有一条主线:**`features → audio → lib` 单向依赖**。`lib/` 必须能在 Node 里跑(不得出现 Web Audio),`audio/` 是唯一接触 Web Audio 的层(`new AudioContext` 全仓库仅一处,由测试强制),features 互不相引、只有 router 能点名视图。"声音流入"和"声音流出"都在 `audio/`,所以视唱这种同时需要两者的功能不必打破任何边界。

```

## 测试 · Tests

```bash
npm test        # Vitest 单元测试
npm run smoke   # Playwright 冒烟(桌面+移动视口:布局、折叠、主题切换、四个工具路由、节拍器、声图、练耳)
```

覆盖:YIN 音高检测(含 B0/D6/A6 宽音域)、合成频谱主导音与色度、和弦识别、级数标注(C 大调/A 小调各级、副属 V/x、KeyTracker 滞后)、i18n 键集一致性、乐器数据逐音符/逐孔位断言(吉他 E2–E4、古筝 21 弦、古琴五调式、口琴 C/G 调与压音表、F4 优先级裁决);节拍器领域(7/8 [2,2,3] 产生 7 个 pulse、6/8 在第 1/4 个八分音符重音、120 BPM 四分音符严格 0.5s、三连音偏移、swing 0%/100%、3:2 复节奏、练习模式逐小节计划)与前瞻调度器(仅调度 horizon 内的事件、跨小节间隔恒定、停止后不再排程);节奏游标(小节内改速度下一个点即生效、改拍号保持当前小节长度、练习模式每小节只掷一次骰、全静音小节跳过后仍对齐)。

## 部署 · Deployment

Vercel 直接导入仓库即可(已配置 `vercel.json` 为 Vite 框架),或:

```bash
npm run build && vercel
```

## 附注 · Notes

- **八度命名**:采用严格科学音高记谱(SPN),midi 23 显示为 B0(五弦贝斯低音弦常称 B1,同音高)。
- **乐器调音**:一次只演奏一个音;扫弦/和弦输入会交给和弦识别,调音器按主音处理。
- **节拍精度**:JS 定时器只负责"提前把未来 100ms 的事件排进去",真正的发声时间来自 `AudioContext.currentTime`;UI 高亮由 rAF 反向跟随音频时钟,Vue 永远不驱动发声。
- **古琴调式**:默认十二平均律;古琴传统用纯律/五度相生调弦,偏差通常小于 5 cent,后续可扩展律制支持。
- 产物自包含、无运行时 CDN;依赖仅 `vue` / `vue-router` / `vuetify` / `@mdi/font`。

## 许可证 · License

[MIT](LICENSE)
