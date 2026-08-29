---
name: metronome-and-audio-engine
description: 共享 AudioEngine 租约、工具级路由、节拍器(加法拍号/重音/细分/swing/复节奏/练习模式);单屏"读数即控件"UI;逐事件调度让编辑下一个点即生效
metadata:
  type: project
---

## 2026-08-29 — 从"调音器应用"升级为"音乐练习工具平台"

依据 `~/Desktop/Suggestion.md` 的分期方案(V2.1→V2.7)一次做完。

### What changed
- **`src/audio/audio-engine.ts`(V2.1)**:全应用唯一 AudioContext,**租约(lease)模型** — `acquireAudio()` 返回 `{ context, master, release() }`,最后一个租约释放才 `close()`。`stores/audio.ts` 不再创建/关闭 context,监听增益改接 `master` 而非 `destination`。根因:原来 AudioContext 的生命周期属于"调音器输入系统",加节拍器后调音器 `stop()` 会把节拍器的时钟一起关掉。
- **工具级路由(V2.2)**:`/tuner` 与 `/metronome` 真正拆开(`/`、`/analyzer`、404 → `/tuner`);`SourceBar`/`StatusPill` 从 AppShell 下沉到 `TuningView` — 节拍器页面不该出现麦克风选择器;AppShell 顶栏改为 `ToolNav`(RouterLink pill)。
- **节拍器 domain(纯函数,V2.3–V2.7)**:
  - `meter.ts`:**拍号 = `{ denominator, groups[] }`**,numerator 由 groups 求和派生。7/8 单靠分子无法描述 2+2+3 / 2+3+2 / 3+2+2。
  - `accent.ts`:每拍 `strong|medium|weak|subdivision|mute`,点击循环编辑;**简单拍(groups 全为 1)只重音第 1 拍**,有分组时每组首拍 medium(否则 4/4 会把 2、3、4 拍都当组首)。
  - `tempo.ts`:`pulseSeconds = (60/bpm) * (beatUnit/denominator)`;tap tempo 丢弃 >3s 的陈旧点击。
  - `rhythm.ts`:编译器 meter+accents+subdivision(+swing/polyrhythm)→ 排序的小节内事件。**swing 在时间层**:`(index + swing/3)/divisions`,swing=1 时八分对变 2/3+1/3;odd divisions 不摇摆。polyrhythm 是均分小节的第二 voice。
  - `practice.ts`:逐小节纯计划(渐进提速 / 静音小节循环 / 随机静音),随机数注入 → 可单测。
- **engine**:`Transport` 接口 + `native-transport.ts`;`scheduler.ts` 为 MDN 前瞻调度器(clock/timer 注入,lookAhead 25ms / horizon 100ms)。**按事件而非按小节出队** — 一小节常比 horizon 长,按小节粒度会让变速和停止延迟整整一小节(第一版就踩到了,测试直接抓出)。⚠️ 这一轮只修了*出队*粒度,*编译*仍按小节冻结 `pulseSeconds` — 真正的响应延迟到迭代 3 才根治。`click-engine.ts` 振荡器+指数包络(hi-hat 用一次性噪声 buffer),`sound-bank.ts` 纯数据 6 种音色。
- **UI**:`activeBeat` 由 rAF 从 `transport.currentAt(now)` 反向拉取 — 音频是主时钟,Vue 从不触发发声。
- **目录**:`features/{tuning,metronome}` + `shared/`;`stores/audio.ts` → `features/tuning/stores/`,AppShell/ToolNav/toggles/CollapsibleCard/panels → `shared/`。

### Validation
103 项 Vitest 全绿(新增 35 项:拍号/重音/速度/编译器/练习/调度器);`vue-tsc --noEmit` 干净;构建成功;`npm run smoke` 桌面+移动双视口全绿,含节拍器真机 AudioContext 走查(7/8 渲染 3 组 7 拍、重音点击、start→`.metro-beat.is-active` 高亮→stop、自定义 3+2+2)。

### Reusable insight
- **前瞻调度器必须按事件出队**,不能按 buffer 单位(小节)出队,否则 horizon 形同虚设。
- 领域层注入时钟/随机数后,"120 BPM 四分音符严格 0.5s""bar 7 静音"这类断言都能在 Node 里跑,完全不需要 AudioContext。
- 共享资源(AudioContext)用租约计数,比"谁开谁关"更适合多工具共存。

## 2026-08-29 (迭代 2)— 节拍器改为单屏:"读数即控件"

### What changed(用户反馈驱动:"不要拆分那么多子页面,点 BPM / 4/4 直接切换")
- **根因**:把调音器的布局模式套错了工具。调音器是"多路读数同时看"(折叠卡片工作台成立);节拍器是"一个焦点 + 偶发配置",6 张卡片把最高频的启停/BPM/拍点挤出视口,改 4/4 还要滚屏。
- **按使用频次重排**:常驻不滚动 = 拍点 + BPM + 播放;中低频(拍号/细分/音色/练习)进 `ControlSheet` — 点哪个值就地展开哪个编辑器(桌面锚定浮层,≤720px 变模态底部抽屉,同时只开一个,Escape / 点遮罩关闭)。
- **BPM 直接输入数字**(用户追加):大号数字本身是 `<input>`,回车/失焦提交并 clamp 到 20–400,`±` 与 ↑↓ 微调,Tap 取速;"BPM ▾" 小标签才是打开细调浮层(slider + 一拍音符)的触发器。
- 空格键启停、↑↓ 调速(全局监听,输入框内跳过)。
- 稀有动作归位:"重置重音"移入拍号浮层;调音器专属的 footnote 从 AppShell 下沉到 TuningView。
- **`.metro-chip-row` 必须放在 `.card` 之外**:`.card` 带 `backdrop-filter` + `overflow:hidden` — 前者让 `position:fixed` 的移动端抽屉相对卡片定位而非视口,后者直接把浮层裁掉。这是本轮唯一的 CSS 陷阱。
- `panels.ts` 的 metro* 面板 id 全部移除(不再有折叠面板)。

### Validation
103 项 Vitest 全绿(领域/引擎零改动);smoke 新增断言:桌面单屏无纵向溢出、`.card` 只有 1 个、chip 打开对应 sheet、7/8 与 3+2+2、Escape/遮罩关闭、互斥打开(仅桌面,移动端是模态)、BPM 输入 96 与越界 999→400、空格启停。截图核对桌面 1280×900 与移动 375×667 均单屏。

### Reusable insight
- **布局模式要跟着工具的使用形态走**,不能跨工具复制:并列读数 → 卡片工作台;单一焦点 → 单屏 + 就地编辑。
- "读数即控件"消灭了"设置在哪张卡里"的记忆负担 — 值显示在哪,改它的控件就从哪展开。
- 数字类主控件优先给输入框:输入 + 步进 + 方向键 + Tap,四种粒度覆盖全部场景,slider 反而退居细调浮层。

## 2026-08-29 (迭代 3)— 改动延迟一小节的根因与修复

### 现象
用户:"切换了节拍后要当前周期后才能生效"。

### 根因
`scheduler` 一次编译**整小节**,且把该小节的 `pulseSeconds` 冻结在小节开头。于是任何编辑(速度/细分/swing/重音)最快也要等下一条小节线 — 60 BPM 的 4/4 就是 4 秒。这不是"lookahead 太长",而是**调度粒度是小节**。

### 修复:`engine/bar-cursor.ts`(纯函数,新)
- 逐**事件**推进:每个事件都重新读取 live pattern 与 live `pulseSeconds()`;位置用 **pulse 单位**保存,发声时才乘以当前脉冲长度。
- **只有 meter 在小节线快照**(小节中途改小节长度会打乱数拍),其余全部下一个点生效。
- `peek()` / `advance()` 拆分:scheduler 只提交 horizon(100ms)内的事件,超出的留在游标里,下一 tick 用**当时**的速度重算 → 已锁定的最多一个点。
- `startBar(barIndex)` 按 barIndex **memoize**:否则 peek 与 advance 会各掷一次骰,练习模式的随机静音会在小节内闪烁。这是拆 peek/advance 时立刻暴露的第二个 bug。
- 全静音小节(所有拍 mute)靠 `carry` 累积 pulses 跳过,后续 barIndex 与 delta 仍对齐(有 MAX_EMPTY_BARS=64 兜底防死循环)。

### Validation
112 项 Vitest(新增 9:游标 7 + scheduler×cursor 集成 2)。真机实测(Playwright + MutationObserver 记录 `.metro-beat.is-active` 时间戳):60 BPM 下相邻拍 1000ms,小节中途改为 240 BPM 后 ~180ms 内切到 250ms 间距,原先要等满 4 秒。

### Reusable insight
- **调度粒度决定响应延迟上限**。前瞻调度器的 buffer 单位必须是"事件",不是"小节/乐句" — 否则 horizon 再小也没用。这个坑在本项目栽了两次(第一次是 buffer 按小节出队,这次是编译按小节冻结参数)。
- `peek/advance` 是让"未提交的未来"保持可变的标准手法;代价是纯函数化 compute,收益是编辑延迟 = horizon 而不是 buffer 长度。
- 拆分只读预览与消费之后,任何带副作用的 per-bar 计算(随机数、状态写入)都必须 memoize,否则会被调用两次。
