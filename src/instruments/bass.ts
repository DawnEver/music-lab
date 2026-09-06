import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). */
export const bass = {
  id: "bass",
  name: { zh: "贝斯", en: "Bass Guitar" },
  category: "plucked",
  timbre: "bass",
  surface: { kind: "frets", frets: 15 },
  tuning: {
    layout: "list",
    defaultPresetId: "standard4",
    presets: [
      {
        id: "standard4",
        name: { zh: "四弦标准", en: "4-string standard" },
        notes: [28, 33, 38, 43], // E1 A1 D2 G2
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      },
      {
        id: "standard5",
        name: { zh: "五弦标准", en: "5-string standard" },
        notes: [23, 28, 33, 38, 43], // B0 E1 A1 D2 G2
        noteLabels: ["5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
