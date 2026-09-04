import type { InstrumentDefinition } from "./types.js";

/** The soprano of the huqin family — a fourth or fifth above the erhu. */
export const gaohu: InstrumentDefinition = {
  id: "gaohu",
  name: { zh: "高胡", en: "Gaohu" },
  category: "bowed",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 340, maxHz: 700, minMidi: 62, maxMidi: 77 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准 (g-d1)", en: "Standard (g-d1)" },
      notes: [67, 74], // G4 D5
      noteLabels: [
        { zh: "内弦", en: "inner" },
        { zh: "外弦", en: "outer" }
      ]
    },
    {
      id: "cantonese",
      name: { zh: "广东音乐 (a-e1)", en: "Cantonese (a-e1)" },
      notes: [69, 76], // A4 E5
      noteLabels: [
        { zh: "内弦", en: "inner" },
        { zh: "外弦", en: "outer" }
      ]
    }
  ]
};
