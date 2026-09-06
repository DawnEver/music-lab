import type { InstrumentDefinition, TuningPreset } from "./types.js";

/**
 * Ruan family, four strings in fifths, low→high (四弦→一弦). The sizes
 * differ only by register: 小阮 is an octave above 大阮, 中阮 sits between.
 */
const LABELS = ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }));

function makeRuanPreset(id: string, name: { zh: string; en: string }, notes: number[]): TuningPreset {
  return { id, name, notes, noteLabels: LABELS };
}

export const ruan = {
  id: "ruan",
  name: { zh: "阮", en: "Ruan" },
  category: "plucked",
  timbre: "nylon",
  surface: { kind: "frets", frets: 12 },
  tuning: {
    layout: "list",
    defaultPresetId: "zhong",
    presets: [
      makeRuanPreset("zhong", { zh: "中阮 (G-d-g-d1)", en: "Zhongruan (G-d-g-d1)" }, [43, 50, 55, 62]),
      makeRuanPreset("da", { zh: "大阮 (C-G-c-g)", en: "Daruan (C-G-c-g)" }, [36, 43, 48, 55]),
      makeRuanPreset("xiao", { zh: "小阮 (g-d1-g1-d2)", en: "Xiaoruan (g-d1-g1-d2)" }, [55, 62, 67, 74])
    ]
  }
} satisfies InstrumentDefinition;
