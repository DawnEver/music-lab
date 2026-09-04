import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). */
export const bass: InstrumentDefinition = {
  id: "bass",
  name: { zh: "贝斯", en: "Bass Guitar" },
  category: "plucked",
  layout: "strings",
  defaultPresetId: "standard4",
  range: { minHz: 26, maxHz: 110, minMidi: 21, maxMidi: 46 },
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
};
