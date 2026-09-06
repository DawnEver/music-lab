import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). A fifth below the violin. */
export const viola = {
  id: "viola",
  name: { zh: "中提琴", en: "Viola" },
  category: "bowed",
  tuning: {
    layout: "list",
    defaultPresetId: "standard",
    presets: [
      {
        id: "standard",
        name: { zh: "标准", en: "Standard" },
        notes: [48, 55, 62, 69], // C3 G3 D4 A4
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
