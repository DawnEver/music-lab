---
name: playable-instruments-refactor-plan
description: 把「乐器」从调音目标集合提升为跨三原语的一等实体;计划 + 实施记录 —— 音色即数据、能力正交、/play 四种演奏面(键盘/指板/鼓垫/音孔)全部落地
metadata:
  type: project
---

## 2026-09-06 — 可演奏乐器重构:架构计划(尚未实现)

> 状态:**阶段 0–5 全部实施完成**(同日,v2.10.0)。上半部分是当初的现状测绘与
> 目标模型,原样保留;文末「实施记录」写清最终做成了什么、哪里偏离了计划、为什么。

### 起点结论

当前仓库里的「乐器」只有一半:它是**调音目标集合**,不是**能发声的乐器**。
`src/instruments/` 的唯一消费者是 `/tune`(`features/tuning/stores/tuner.ts`),
全仓库没有任何地方从乐器定义里取音色。要做键盘/钢琴/吉他/贝斯/鼓/管乐的音色,
本质是把乐器从「sound in 的一个参数」提升为**跨三原语的一等实体**。

---

## 一、现状测绘

### 数据契约(`src/instruments/types.ts`)
`InstrumentDefinition` = `id` + `name(zh/en)` + `category`(plucked/bowed/winds/other)
+ `layout`(list/grid/fingering) + `presets[]` + 可选 `range` / `reeds` / `wind` / `variants`。
`TuningPreset` = `notes: number[]`(MIDI,**物理显示顺序,不是音高顺序**)+ 并行的
`noteLabels` / `fingerings`。

### 统一模型(`src/instruments/targets.ts`)
`TuningTarget` 是目前全仓库唯一的「乐器可玩单元」抽象 —— 一根弦、一片簧片、
一根琴键、一个孔×吹吸,都是「能发出已知音高的东西」。
- `buildTargets()`:list 逐音映射;grid 由 `HarmonicaLayout` + 主音展开
  blow/draw/bend/overbend。
- `nearestTarget()`:`|cents| → POSITION_PRECEDENCE → 索引` 三级排序。
- `deriveRange()`:**从数据推导**检测频带(±2 半音余量),频带永不与数据漂移。

### 消费面(很窄)
| 消费者 | 用到什么 |
|---|---|
| `features/tuning/stores/tuner.ts` | `getInstrument` / `buildTargets` / `deriveRange` / `getPreset` |
| `StringsPanel` / `HarmonicaPanel` / `FingeringPanel` | 三种 `layout` 各一个渲染器 |
| `InstrumentSelect.vue` | `instrumentCategories` + `instrumentsByCategory` |
| `shared/stores/reference.ts` | 选中目标的 midi 发布给 `/trace` |

### 发声侧(与乐器完全无关)
- `audio/voice.ts` —— **全 app 唯一合成器**。`VoiceSpec` = 波形 + 频率 + 增益 +
  时长 + attack + glide + `partials[]`。加法合成,**无滤波器、无 release 曲线、
  无力度、无采样**。
- `features/metronome/engine/sound-bank.ts` —— `SOUND_BANKS` 六种点击音色,
  数据驱动。**这是「音色即数据」目前唯一的先例,新模型应当以它为形状。**
- `features/ear/engine/player.ts` 的 `noteSpec()` —— 正弦 + 三个泛音,
  **硬编码**,被 ear 与 sing 两处共用。

### 今天「加一个乐器」要动的文件(完整清单)
1. 新建 `src/instruments/<name>.ts`
2. `src/instruments/index.ts` 导入 + 加进 `allInstruments` 的分类顺序
3. 若属新分类:`InstrumentCategory` 联合 + `tuner.category.<x>` 中英两条词条
4. 若属新布局:`InstrumentLayout` 联合 + 新面板组件 + `TuningView` 分发
5. `tests/instruments.test.ts` 加逐音锁定测试(改数据即改测试)
6. i18n 键 zh/en 对齐、无重复(`tests/i18n.test.ts` 强制)

自动兜底:唯一 id、默认 preset 存在、每音有标签、频带覆盖且跨度 < 60 半音 ——
全部由 `tests/instruments.test.ts` 的三条注册表不变式检查。

---

## 二、三个结构性缺口

**缺口 1:乐器有调音,没有身份。**
钢琴没有「调音预设」可言(88 键都是目标,且用户不给钢琴调音),架子鼓根本没有音高。
现有 `InstrumentDefinition` 强制 `presets[].notes`,钢琴与鼓无法表达。

**缺口 2:音色不是数据。**
`noteSpec()` 硬编码在 ear 的 engine 里;`audio/voice.ts` 的能力上限(无滤波、
无 velocity、无采样)决定了钢琴、拨弦、军鼓只能是同一个加法音。要「不同音色」,
必须先扩发声层的表达力。

**缺口 3:没有「演奏」这个原语。**
现有三原语是 sound in / sound out / 音乐意义。键盘是第四类交互:
**人的实时输入 → 立即发声**。它既不是麦克风输入,也不是预排程播放
(`ear/engine/player.ts` 明说「短乐句一次性放上时钟」),而是 note-on/note-off
的开放流。`audio/scheduler.ts` 的 look-ahead 模型不适用,需要新的 performer 模型。

---

## 三、目标模型

把 `InstrumentDefinition` 拆成**正交的能力切片**,每片可选;加乐器仍然只是加一个数据文件。

```
InstrumentDefinition {
  id, name, category
  tuning?:  { layout, presets[], reeds?, wind?, variants? }   // 现有内容整体挪进来
  timbre?:  TimbreId | TimbreId[]                             // 新:可发声
  surface?: PlaySurface                                       // 新:怎么演奏
  range?:   PitchBounds                                       // 仍由 deriveRange 兜底
}

PlaySurface = "keys" | "frets" | "pads" | "holes"
```

- `tuning` 缺席 → 不出现在 `/tune` 的选择器里(钢琴、鼓)。
- `timbre` 缺席 → 只能被调音、不能被演奏(古琴可以先只做调音)。
- `deriveRange()` 需扩展为也能从 `surface` 推导(钢琴 A0–C8),不再只从 targets 推导。
- **鼓不进音高模型**:`surface === "pads"` 时单元是 kit piece
  (kick/snare/hihat/tom…),有 `timbre` 无 `midi`,只是恰好按 GM 打击乐编号映射。
  把它塞进 `TuningTarget` 会破坏「目标 = 已知音高」这条定义,不许做。

新增一层 `audio/timbre.ts`(放 `audio/`,因为演奏是 in+out 双向工具的公共依赖,
符合「两个 feature 需要同一样东西就下移图层,绝不放宽边界」):

```
Timbre { id, name, layers: VoiceSpec[], velocityCurve, release, filter? }
```

`SOUND_BANKS` 是它的先例;`noteSpec()` 应被吸收成 `TIMBRES.singable`。

---

## 四、分阶段路线

### 阶段 0 — 打地基,不加任何乐器(纯重构,零可见变化)
- `noteSpec()` 从 `features/ear/engine/` 提到 `audio/timbre.ts`,建立 `TIMBRES` 表
  (先只有 `singable` 一条),ear/sing 改为引用。
- 扩 `audio/voice.ts`:`release`、`filter`(lowpass + 包络)、`velocity`。
- 测试:扩 `tests/audio-voice.test.ts`;`tests/feature-boundaries.test.ts`
  自动保证 `audio/` 不反向依赖 feature。

### 阶段 1 — 键盘(新路由 `/play`)—— **整个计划的验证关口**
最小可玩:`features/keyboard/`,屏幕键盘 + 电脑键盘映射 + Web MIDI(可降级)。
- `domain/keymap.ts` 纯函数(Node 可测:物理键 → midi,含八度移位)
- `engine/performer.ts`:**note-on/note-off 实时模型**,不是 scheduler。
  所有时间戳仍取 `AudioContext.currentTime`(硬规则)。
- 音色选择器复用 `SOUND_BANKS` 的数据驱动形状。
- 路由按「玩家在做什么」命名:`/play`。

键盘跑通 = timbre + surface + performer 三件套成立,后面每个乐器才退化成加数据。

### 阶段 2 — 音色扩展:钢琴 / 电钢 / 风琴
**必须拍板的分叉:**

| 方案 | 体积 | 真实度 | 代价 |
|---|---|---|---|
| 扩展加法合成(**建议先走**) | 0 KB | 中低 | 钢琴/鼓勉强,管乐尚可 |
| 采样(soundfont / 单音循环采样) | 每乐器 0.5–5 MB | 高 | 资源管线、许可审查、懒加载、离线策略 |

**建议**:阶段 2 全合成,先把 `Timbre` 契约定死;采样留作 `Timbre` 的第二种
`source` 在阶段 5 接入,届时上层代码一行不动。避免过早引入资源管线。

### 阶段 3 — 吉他 / 贝斯(surface = frets)
指板界面。**吉他已有 8 种调弦数据**,`tuning.presets` 直接驱动品格布局:
弦音高 + 品位 = midi。数据复用收益最大的一档,**不需要新数据文件**。
音色:拨弦 = 快 attack + 指数衰减 + 高次泛音衰减更快(依赖阶段 0 的 filter 包络)。

### 阶段 4 — 架子鼓(surface = pads)
独立子模型 `DrumKit { pieces: [{id, name, timbre, padSlot}] }`。
噪声源 + 带通在 `voice.ts` 的 hihat bank 已有雏形。
天然想与 `/rhythm` 的 transport 结合 —— **但 features 不得互相 import**,
共享排程必须走 `audio/transport.ts` 接口。

### 阶段 5 — 管乐(dizi / xiao / sax)
指法数据已在 `wind-fingerings.ts` 与 `saxophone.ts`。演奏面 = 可点击的指法图,
反过来复用现有 `FingeringPanel`。音色需要吹管的 breath noise 层 ——
**这是最考验合成方案的一项,很可能是第一个真正需要采样的家族。**

---

## 五、贯穿约束(实现时别踩)

- **一个时间基准**:演奏、录制、绘制只能用 `AudioContext.currentTime`;
  rAF 循环必须**在循环内**读时钟。
- **图层单向 `features → audio → lib`**:`lib/` 必须能在 Node 跑,所以 keymap、
  音色参数表可放 `lib/`,`Timbre` 的播放实现必须在 `audio/`。
- **一切可枚举的都是数据**:新音色、新 kit、新 surface = 新一行数据 +
  (必要时)一个渲染器,绝不是新代码路径。
- **i18n 键的联合类型必须收口**:`TimbreId`、`SurfaceKind`、`KitPieceId`
  都要是闭合联合,不能放宽成 `string`(`tests/i18n.test.ts` 依赖这点)。
- **发声时 hold capture**:`/play` 若同时开麦克风,遵守「参考音响起时不录自己」。
- **TDD + 双视口 smoke**:每阶段先写失败测试;键盘/指板/鼓垫是几何密集 UI,
  `npm run smoke` 两个视口都要跑。

---

## 六、建议的第一步

阶段 0 + 阶段 1 一次交付:`audio/timbre.ts` + `/play` 屏幕键盘 + 3 个合成音色。
不改任何现有行为,却把三个缺口一次打开;此后每个乐器家族退化为
「加数据 + 加渲染器」。

### Reusable insight
- **「乐器」这个词在本仓库长期被窄化成「调音目标集合」**。任何要让乐器发声的需求,
  第一步都不是加乐器,而是把身份/调音/音色/演奏面这四个维度拆开 —— 它们正交,
  强行合并会逼出钢琴和鼓这两个反例。
- **架子鼓是模型的试金石**:任何「统一乐器抽象」如果能把无音高的鼓塞进去,
  说明这个抽象已经松到没有约束力了。
- 音色方案(合成 vs 采样)的决策应当**推迟到契约定死之后**,而不是之前 ——
  契约稳定时,换 source 是零成本的。

---

# 实施记录(2026-09-06,阶段 0–5 全部落地)

七个提交,470 项单测 + 双视口 smoke 全绿,`vue-tsc` 干净。

## 最终形态

**乐器 = 身份 + 正交能力**,两种能力都可选:
```ts
{ id, name, category,
  tuning?: { layout, presets, reeds?, wind?, variants? },   // 出现在 /tune
  timbre?: TimbreId,                                        // 出现在 /play
  surface?: PlaySurface }
```
`TunedInstrument` / `PlayableInstrument` 用**类型收窄**表达能力,不是布尔标志 ——
是编译器而不是注释拦住「鼓进 buildTargets」。

`PlaySurface` 是判别联合,不是枚举 —— 指板需要品数,键盘不需要,两者不该互相背对方的字段:
| kind | 画成 | 音高来源 |
|---|---|---|
| `keys` | 钢琴键 | 键位映射 + 八度 |
| `frets` | 指板 | 空弦 + 品位算术(每品一个半音) |
| `holes` | 指法图 | preset 的 `fingerings`(故必须同时可调音) |
| `pads` | 鼓垫 | **无音高**,每个 piece 自带 timbre 与 Hz |

`/play` 一个路由承载四种面。**乐器是唯一的选择** —— surface 决定画什么,
timbre 决定响什么;单独的音色菜单会让名字和声音互相矛盾。

## 与原计划的偏离(三处,都是实现中才看清的)

1. **没有做成「键盘工具 + 音色选择器」**。原计划阶段 1 是键盘 + 3 个音色 chip。
   实现到阶段 3 才发现:钢琴/电钢/风琴本来就是三件**乐器**,不是一个乐器的三种音色。
   于是音色 chip 整个删掉,合并进乐器选择器,`features/keyboard` 改名 `features/play`。
2. **`isPlayable` 不要求 instrument 级 timbre**。鼓的 instrument 级音色无物可指,
   逼它填一个就是逼它撒谎。改成:有音高的面要 timbre,pads 面由每个 piece 自带。
3. **采样方案没有启用,也不需要了**。原计划把「合成 vs 采样」列为待拍板项,
   预期管乐是第一个必须采样的家族。实际给 `VoiceSpec` 加了一层 **breath 噪声层**
   (循环噪声 + 高通在两倍频,骑同一条包络)之后,笛箫萨克斯已经足够可辨。
   **契约先定死、source 后换**这一步是对的,但换的时机被推迟到了「暂时不需要」。

## 发声层最终能力(`audio/voice.ts` + `audio/timbre.ts`)

- 包络两种形状:**无 sustain = 拨弦**(自己衰减到静音),**有 sustain = ADSR**
  (风琴、吹管)。松键对拨弦只是提前止音 —— 这正是手指离开钢琴键做的事。
- `filter`:截止频率**按音的谐波数**给,不是固定 Hz,所以同一音色在低音区不发闷、
  高音区不发尖。`envelope` 是起音时截止的倍数,随音衰减回落 —— 拨弦"越衰减越暗"。
- `velocity` 同时缩放响度和滤波开度(敲得重 = 更亮)。
- `hold()` 返回 `HeldVoice`,`release()` 用 `cancelAndHoldAtTime` 从音符实际所在的
  电平往下走;已在自然结束的音不会被 release 拉长。
- `breath`:循环噪声层,吹管的关键。
- 16 个音色:piano / epiano / organ / steel / nylon / bass / kick / snare / hihat /
  hihatOpen / tom / crash / ride / flute / reed / singable。
  **区分乐器的是包络与亮度随时间的变化,不是波形。**

## 演奏原语(`features/play/engine/performer.ts`)

不是调度器,是**当前按下了什么的登记表**:`noteOn/noteOff/strike/allOff`。
时钟仍然注入且仍然是 `AudioContext.currentTime`。
`strike()` 给无音高的一击;同一 choke group 的 piece 互相掐断 —— 一个字段,
却是闭镲听起来像闭镲而不是两片无关的铜的唯一原因。

## 顺手修掉的真 bug

- **smoke 自启的 dev server 会挂死**:stderr 被 pipe 却无人读取,缓冲区填满后
  vite 阻塞,表现为整个测试卡住。同时 Windows 上 `shell: true` 杀掉的是 cmd,
  真正的 vite 继续占着端口。改为直接用 `process.execPath` 跑 `vite/bin/vite.js`。
- **Vuetify 下拉不能放进 ControlSheet**:菜单浮层 teleport 到 sheet 外,点选项被
  判定为点到外面,sheet 在指针下先关掉了。改用 chip —— 顺带也符合
  「选项全部可见」那条规则。

## Reusable insight

- **「先做能力最强的那件,再做最简单的那件」是错的顺序**。真正定型模型的是
  **架子鼓**:任何能把无音高的鼓塞进去的「统一乐器抽象」都已经松到不约束任何东西。
  应该更早拿它当判据,而不是等到阶段 4。
- **同一份数据被第二个工具用上时,才知道它建模得对不对**。吉他的 8 种调弦
  在调音器里躺了很久,直到指板复用它 —— 每品一个半音,Drop D / DADGAD / 七弦
  全部免费。反过来,`layout`/`presets` 挂在乐器顶层这件事,也是直到钢琴和鼓
  出现才暴露为错。
- **判别联合优于「枚举 + 一堆可选字段」**:`surface: {kind:"frets", frets}` 让
  「键盘没有品数」成为类型事实,而不是一条注释。
- **不要为了未来的能力提前引入资源管线**。采样最终没做,因为契约定死之后,
  一个 breath 噪声层就把管乐的差距补掉了。
