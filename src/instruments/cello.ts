import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). An octave below the viola. */
export const cello: InstrumentDefinition = {
  id: "cello",
  name: { zh: "大提琴", en: "Cello" },
  category: "bowed",
  layout: "list",
  defaultPresetId: "standard",
  presets: [
    {
      id: "standard",
      name: { zh: "标准", en: "Standard" },
      notes: [36, 43, 50, 57], // C2 G2 D3 A3
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
