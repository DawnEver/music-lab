import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). */
export const violin: InstrumentDefinition = {
  id: "violin",
  name: { zh: "小提琴", en: "Violin" },
  category: "strings",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 180, maxHz: 700, minMidi: 53, maxMidi: 77 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准", en: "Standard" },
      notes: [55, 62, 69, 76], // G3 D4 A4 E5
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
