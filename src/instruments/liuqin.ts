import type { InstrumentDefinition } from "./types.js";

/** Four strings in fifths, an octave above the 中阮 (四弦→一弦). */
export const liuqin = {
  id: "liuqin",
  name: { zh: "柳琴", en: "Liuqin" },
  category: "plucked",
  tuning: {
    layout: "list",
    defaultPresetId: "standard",
    presets: [
      {
        id: "standard",
        name: { zh: "标准 (g-d1-g1-d2)", en: "Standard (g-d1-g1-d2)" },
        notes: [55, 62, 67, 74], // G3 D4 G4 D5
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
