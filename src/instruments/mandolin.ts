import type { InstrumentDefinition } from "./types.js";

/**
 * Four courses of paired strings, tuned like a violin. The pair is tuned
 * in unison, so the tuner targets one note per course (4弦→1弦).
 */
export const mandolin: InstrumentDefinition = {
  id: "mandolin",
  name: { zh: "曼陀林", en: "Mandolin" },
  category: "plucked",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 180, maxHz: 700, minMidi: 53, maxMidi: 77 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准 (GDAE)", en: "Standard (GDAE)" },
      notes: [55, 62, 69, 76], // G3 D4 A4 E5
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
