import type { InstrumentDefinition } from "./types.js";

/**
 * Sounding pitches (the part is written an octave higher). Tuned in
 * fourths, unlike the rest of the bowed family; the 5-string adds a low B,
 * and orchestral players often tune the low E down to C for Bach.
 */
export const doubleBass: InstrumentDefinition = {
  id: "double-bass",
  name: { zh: "低音提琴", en: "Double Bass" },
  category: "bowed",
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
    },
    {
      id: "lowC",
      name: { zh: "低音 C 延伸", en: "Low C extension" },
      notes: [24, 33, 38, 43], // C1 A1 D2 G2
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
