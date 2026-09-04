import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (4弦→1弦). An octave below the viola. */
export const cello: InstrumentDefinition = {
  id: "cello",
  name: { zh: "大提琴", en: "Cello" },
  category: "bowed",
  layout: "strings",
  defaultPresetId: "standard",
  range: { minHz: 55, maxHz: 240, minMidi: 33, maxMidi: 60 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准", en: "Standard" },
      notes: [36, 43, 50, 57], // C2 G2 D3 A3
      noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
