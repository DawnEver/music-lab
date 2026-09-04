import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). A fifth below the violin. */
export const viola: InstrumentDefinition = {
  id: "viola",
  name: { zh: "中提琴", en: "Viola" },
  category: "bowed",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 110, maxHz: 470, minMidi: 45, maxMidi: 72 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准", en: "Standard" },
      notes: [48, 55, 62, 69], // C3 G3 D4 A4
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
