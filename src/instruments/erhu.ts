import type { InstrumentDefinition } from "./types.js";

/** MIDI, 内弦 (low) → 外弦 (high). */
export const erhu: InstrumentDefinition = {
  id: "erhu",
  name: { zh: "二胡", en: "Erhu" },
  category: "strings",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 280, maxHz: 470, minMidi: 60, maxMidi: 70 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准 (D-A)", en: "Standard (D-A)" },
      notes: [62, 69], // D4 A4
      noteLabels: [
        { zh: "内弦", en: "inner" },
        { zh: "外弦", en: "outer" }
      ]
    }
  ]
};
