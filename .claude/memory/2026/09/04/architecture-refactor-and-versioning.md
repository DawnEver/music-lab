---
name: architecture-refactor-and-versioning
description: 第一性原理梳理后一次做完的 8 项重构:AnalysisPipeline 抽层、import 图守边界、统一 TuningTarget 模型、store 显式 hydrate、persist 层、audio store 拆分、组件测试层、i18n 拆分与 key 类型化、PWA 离线;版本号单一来源 + pre-push 自动打 tag
metadata:
  type: project
---

## 2026-09-04 — 从第一性原理梳理架构,并把 8 条改进全部落地

### 起点:两个工具的建模强度不对称
节拍器有 `domain/`(纯函数)→ `engine/`(注入时钟)→ `stores/` → UI 的严格分层,假时钟就能跑完整调度;**调音侧没有对应结构** — `analysis-loop.ts` 是 15 个模块级可变变量 + rAF + AnalyserNode 焊死。于是"调音准不准、跳不跳"的全部决策(双节拍 88/105ms、YIN 与频谱仲裁、平滑、静音衰减)一行测试都没有。这个不对称是后面多数问题的根。

### What changed(按依赖顺序)
1. **`lib/analysis-pipeline.ts`**:`AnalysisPipeline.push({now, frequencyData, readTimeData, ...})` 拿帧和时钟,返回 display 快照。`readTimeData` 是**惰性 getter** — 保住"只有音高节拍到点才读时域缓冲"的优化,同时让测试能数它被调用几次。`analysis-loop.ts` 缩成 134 行浏览器适配器。首帧必跑两遍分析:`lastPitchAt` 初值用 `-Infinity` 而不是 0(clock origin 不确定)。
2. **边界测试改为解析 import 图**(原来是 3 条手写 grep + 300 行上限):features 互不相引、lib/shared/instruments/audio/composables 不引 features、**只有 router 能点名 feature 视图**、所有相对 import 必须可解析。300 行上限被删 — 它量的是症状(`stores/audio.ts` 卡在 299 行),不是规则。
3. **统一 `TuningTarget` 模型**(`instruments/targets.ts`):吉他弦、卡林巴键、口琴孔是同一件事 —「一个可演奏物 + 它能发的若干音高 + 可选的网格坐标 slot」。于是 `nearestString`/`nearestPosition` 合成 `nearestTarget`,`activeString`/`activeCell`/`autoString`/`autoMatch` 四个状态塌缩成 `{targetIndex, positionIndex}` 一对。`layout: "strings"|"harmonica"` → `"list"|"grid"`;`harmonica`/`harmonicaVariants` → `reeds`/`variants`;`range` 由 `deriveRange()` 推导(±2 半音余量),仅保留覆盖字段。**网格列由 targets 的 slot 反推,不再硬编码 10×2**。
4. **`features/tuning/stores/tuner.ts`**:原 `composables/useTuner.ts` 是伪装成 composable 的模块单例,且 **import 时就读 localStorage**。改为 store + 显式 `hydrateTuner()`(由 TuningView 调用),每乐器的 preset/variant 从 2N 个 key 收成一条记录。
5. **`lib/persist.ts`**:`storedString` / `storedJson(key, fallback, revive, legacyKey)`。四套手写 try-catch 收敛为一处,前缀 `tcl-` → `ml.` 并在首次读取时迁移(index.html 的防闪烁脚本同时读新旧 key)。
6. **`stores/audio.ts` 299 行拆成四块**:`audio-graph.ts`(租约/analyser/monitor)、`mic-source.ts`、`file-source.ts`、`audio.ts`(会话门面 58 行);状态文案 setter 挪到 `audio-state.ts` 与它写的状态放一起。
7. **测试金字塔补中间层**:`tests/components/` 用 happy-dom + @vue/test-utils 真挂载面板(行数、标签、展开压音、切换簧片布局、pin 目标);vitest 配 `projects: [unit(node), components(happy-dom)]`;**smoke 自己 spawn/kill vite**(以前要手动先起 dev server),只保留浏览器才能回答的:布局几何、横向溢出、路由、i18n、版本徽标。
8. **i18n 拆分 + key 类型化**:466 行大表拆成 `dictionaries/{shell,tuning,metronome}.ts`,`MessageKey = keyof typeof zh`,`t()` 收窄到 MessageKey。**模板字面量 key 仍然可校验** —— `` t(`tuner.kind.${kind}`) `` 在 kind 是字面量联合时本身就是联合类型,代价是把原本 `string` 的封闭集合命名出来:`SoundBankId` / `SubdivisionKey` / `ChordTypeKey` / `Breath` / status key。**这一步立刻抓出真 bug:`tuner.kind.open` 字典里根本不存在**,pin 一根弦时标签会渲染成空。
9. **PWA**:`vite-plugin-pwa` precache 全部构建产物 + manifest。断网 reload 实测:标题、面板、6 根吉他弦全部正常。

### 版本工作流(用户要求)
- `package.json` 是版本单一来源 → vite `define: __APP_VERSION__` → 顶栏标题旁 `v2.1.0` 徽标(链到该 tag 的 release)。
- **`.githooks/pre-push`(入库跟踪)**:push 时若 `v<version>` tag 不存在就创建并一并推送;已存在则静默跳过;`MUSIC_LAB_SKIP_TAG=1` 用于内层推送防递归。`npm run prepare` 里 `git config core.hooksPath .githooks`,新克隆装依赖即生效。
- 本轮发布 v2.1.0。

### Validation
158 项测试(unit + components)全绿;`vue-tsc --noEmit` 干净;`npm run smoke` 桌面+移动双视口全绿;断网 reload 实测通过。

### Reusable insight
- **不对称是最好的重构信号**:同一个仓库里,一个工具能用假时钟测完,另一个连节拍都测不了 —— 差的不是测试,是缺一层。照着已被证明的那一层去镜像,比自己发明架构可靠。
- **把边界写成可执行的图查询**,而不是行数上限或几条 grep。行数上限只会逼人把文件切碎,不会阻止越界。
- **能推导的状态不要存**(range),**能合并的状态不要并列**(string/cell 两套选择)。两者都在这次会话里当场造成过 bug。
- **给字符串起类型,编译器就会替你找字典漏洞**:key 类型化的收益不是防手滑,而是把"动态拼出来的 key 到底存不存在"这个原本不可判定的问题变成可判定的。
- 惰性 getter(`readTimeData`)是把"性能优化"传进纯逻辑层而不破坏可测性的通用手法。
