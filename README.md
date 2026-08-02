# 音调与和弦侦测器 · Tone Chord Lab

> 实时音高与和弦识别工具 — 麦克风输入、对数频谱、YIN 时域 + 谐波频谱双路音高检测、和弦识别。纯前端、零依赖、无后端、无 CDN，音频只在浏览器本地处理，**不会上传**。
>
> Real-time pitch & chord detector — mic input, log-frequency spectrum, dual YIN time-domain + harmonic-spectrum pitch detection, and chord recognition. Fully client-side, zero dependencies, no backend, no CDN. Audio never leaves your browser.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](#测试)

## 功能 · Features

- 🎙️ 麦克风实时输入，支持切换麦克风设备
- 🎵 打开本地音频文件分析（WAV / MP3 / M4A / OGG 等）
- 📊 实时对数频率频谱，约 40 Hz–12 kHz
- 🔊 输入音量与 dB 电平显示
- 🎼 主导音高识别：音名与八度（如 A4）、实际频率、音准偏差（cent）、检测置信度
- 🧬 YIN 时域检测与谐波频谱检测自动切换；多音输入优先频谱主导音，避免误识别共同次谐波
- 🎸 和弦识别：大三 / 小三 / 减三 / 增三 / sus2 / sus4 / 五度 / 属七 / 大七 / 小七
- 🎹 十二音色度能量图，高亮根音与和弦组成音
- ⚙️ 可调 A4 基准音、噪声门与识别稳定度
- 📱 桌面端与移动端响应式界面

## 快速开始 · Quick Start

本项目是**纯静态站点**，拆分为 ES 模块后**不能**直接双击 `index.html`（浏览器对 `file://` 下的模块加载有 CORS 限制）。请通过本地 HTTP 服务器或部署后的 HTTPS 地址访问。

```bash
# 任意一种本地服务器均可
python3 -m http.server 8000
# 或
npx serve .
```

然后打开 <http://localhost:8000>（建议最新版 Chrome / Edge / Firefox / Safari）。

> **麦克风需要安全上下文**：请通过 HTTPS 或 `localhost` 访问才能调用麦克风。分析本地音频则无此限制。

## 工作原理 · How It Works

- **频谱**：`Web Audio API` 的 `AnalyserNode` 提供 16384 点 FFT 实时频域与时域数据（`js/dsp.js`、`js/draw.js`）。
- **单音检测**：`YIN` 时域算法（`detectPitchYin`）与谐波频谱打分（`analyzeSpectrum`）并行运行，按置信度自动切换；多音时优先频谱主导音，避免 YIN 把共同次谐波当作基频。
- **和弦识别**：从频谱峰值提取 12 维色度向量（`buildChromaFromPeaks`），与和弦模板做余弦匹配（`detectChord`），并用连续帧稳定（`stabilizeChord`）。
- **公共 API**：`window.ToneChordLab` 暴露 `detectPitchYin`、`analyzeSpectrum`、`detectChord`、`frequencyToNote`。

## 项目结构 · Structure

```
tone-chord-lab/
├── index.html            # 页面壳
├── css/
│   └── style.css         # 样式
├── js/
│   ├── music-theory.js   # 音名 / 和弦模板 / 频率换算
│   ├── dsp.js            # YIN 音高、RMS、频谱峰值、色度提取
│   ├── chord.js          # 和弦识别
│   ├── draw.js           # 频谱画布渲染
│   └── app.js            # 控制器：状态 / 事件 / 音频图 / 渲染循环
├── test/                 # Node 内置测试（零依赖）
├── package.json
├── vercel.json           # 显式静态托管配置
└── LICENSE
```

## 测试 · Tests

算法部分（音高 / 频谱 / 和弦）是纯函数，使用 Node 内置测试运行器，**零额外依赖**：

```bash
npm test          # 或 node --test
```

覆盖：`frequencyToNote(440) → A4`、MIDI 往返换算、C / Am / G7 和弦识别、合成正弦信号的 YIN 音高检测、合成 C 大三和弦频谱的主导音与色度。

## 部署 · Deployment

### Vercel（推荐 · Recommended）

这是一个纯静态站点，Vercel 可直接托管：

1. 把仓库推送到 GitHub。
2. 在 [vercel.com](https://vercel.com) 中 **Import Project → 选择本仓库**，框架会自动识别为静态站点（`vercel.json` 已显式指定 `"framework": null`）。
3. 点击 **Deploy**，得到形如 `https://tone-chord-lab.vercel.app` 的 HTTPS 地址。

或使用 CLI（需要已登录）：

```bash
npm i -g vercel
vercel
```

### GitHub Pages

本项目同样兼容 GitHub Pages（在仓库 Settings → Pages 中选择部署分支即可）。

## 许可证 · License

[MIT](LICENSE)
