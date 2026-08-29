---
name: metronome-and-audio-engine
description: V2.1–V2.7 升级 — 共享 AudioEngine、工具级路由、节拍器(加法拍号/重音/细分/swing/复节奏/练习模式)与前瞻调度器
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
- **engine**:`Transport` 接口 + `native-transport.ts`;`scheduler.ts` 为 MDN 前瞻调度器(clock/timer 注入,lookAhead 25ms / horizon 100ms)。**按事件而非按小节出队** — 一小节常比 horizon 长,按小节粒度会让变速和停止延迟整整一小节(第一版就踩到了,测试直接抓出)。`click-engine.ts` 振荡器+指数包络(hi-hat 用一次性噪声 buffer),`sound-bank.ts` 纯数据 6 种音色。
- **UI**:`activeBeat` 由 rAF 从 `transport.currentAt(now)` 反向拉取 — 音频是主时钟,Vue 从不触发发声。
- **目录**:`features/{tuning,metronome}` + `shared/`;`stores/audio.ts` → `features/tuning/stores/`,AppShell/ToolNav/toggles/CollapsibleCard/panels → `shared/`。

### Validation
103 项 Vitest 全绿(新增 35 项:拍号/重音/速度/编译器/练习/调度器);`vue-tsc --noEmit` 干净;构建成功;`npm run smoke` 桌面+移动双视口全绿,含节拍器真机 AudioContext 走查(7/8 渲染 3 组 7 拍、重音点击、start→`.metro-beat.is-active` 高亮→stop、自定义 3+2+2)。

### Reusable insight
- **前瞻调度器必须按事件出队**,不能按 buffer 单位(小节)出队,否则 horizon 形同虚设。
- 领域层注入时钟/随机数后,"120 BPM 四分音符严格 0.5s""bar 7 静音"这类断言都能在 Node 里跑,完全不需要 AudioContext。
- 共享资源(AudioContext)用租约计数,比"谁开谁关"更适合多工具共存。
