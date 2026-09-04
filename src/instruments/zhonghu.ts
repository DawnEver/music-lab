import type { InstrumentDefinition } from "./types.js";

/** The alto of the huqin family — a fifth (or fourth) below the erhu. */
export const zhonghu: InstrumentDefinition = {
  id: "zhonghu",
  name: { zh: "中胡", en: "Zhonghu" },
  category: "bowed",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 165, maxHz: 350, minMidi: 53, maxMidi: 66 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准 (G-d)", en: "Standard (G-d)" },
      notes: [55, 62], // G3 D4
      noteLabels: [
        { zh: "内弦", en: "inner" },
        { zh: "外弦", en: "outer" }
      ]
    },
    {
      id: "aTune",
      name: { zh: "A-e 定弦", en: "A-e tuning" },
      notes: [57, 64], // A3 E4
      noteLabels: [
        { zh: "内弦", en: "inner" },
        { zh: "外弦", en: "outer" }
      ]
    }
  ]
};
