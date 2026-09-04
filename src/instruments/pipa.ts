import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (缠弦 → 子弦). */
export const pipa: InstrumentDefinition = {
  id: "pipa",
  name: { zh: "琵琶", en: "Pipa" },
  category: "plucked",
  layout: "list",
  defaultPresetId: "standard",
  presets: [
    {
      id: "standard",
      name: { zh: "标准 (A-d-e-a)", en: "Standard (A-d-e-a)" },
      notes: [45, 50, 52, 57], // A2 D3 E3 A3
      noteLabels: [
        { zh: "缠弦", en: "4" },
        { zh: "老弦", en: "3" },
        { zh: "中弦", en: "2" },
        { zh: "子弦", en: "1" }
      ]
    }
  ]
};
