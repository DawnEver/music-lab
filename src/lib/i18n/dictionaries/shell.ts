/** Shell chrome: brand, navigation, notices, footer. */
export const shell = {
  zh: {
    appTitle: "音乐实验室",
    eyebrow: "本地音乐工具",
    navTuner: "调音器",
    secureNoticeTitle: "当前页面无法直接读取麦克风。",
    secureNoticeBody: "请通过 HTTPS 或 localhost 打开；也可以使用“打开音频”分析本地文件。",
    footnoteLabel: "提示",
    footnoteText: "单音检测适合哼唱、乐器调音；和弦识别是实时启发式结果，清晰的持续和弦、较少环境噪声会更稳定。",
    copyrights: "© 2026 音乐实验室",
    languageAria: "切换语言",
    themeToggleAria: "切换深浅主题",
    themeToLight: "切换到浅色主题",
    themeToDark: "切换到深色主题",
    navLabel: "工具",
    navTuning: "调音与分析",
    navMetronome: "节拍器"
  },
  en: {
    appTitle: "Music Lab",
    eyebrow: "Local music tools",
    navTuner: "Tuner",
    secureNoticeTitle: "The microphone cannot be accessed on this page.",
    secureNoticeBody: "Open via HTTPS or localhost, or use “Open audio” to analyze a local file.",
    footnoteLabel: "Tip",
    footnoteText: "Monophonic detection suits humming and instrument tuning; chord recognition is a real-time heuristic and works best with clear sustained chords and low background noise.",
    copyrights: "© 2026 Music Lab",
    languageAria: "Switch language",
    themeToggleAria: "Toggle dark/light theme",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
    navLabel: "Tools",
    navTuning: "Tuning & Analysis",
    navMetronome: "Metronome"
  }
} as const;
