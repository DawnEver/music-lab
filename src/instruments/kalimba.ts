import type { InstrumentDefinition } from "./types.js";

/**
 * 17-key kalimba in C. Tines are ordered by physical position, not pitch:
 * the longest (lowest) tine sits in the middle and the scale alternates
 * outward, left / right / left … Labels follow the numbers engraved on
 * the tines (numbered notation, · marks the octave above).
 */
const TINES: Array<{ midi: number; label: string }> = [
  { midi: 86, label: "2··" }, // D6
  { midi: 83, label: "7·" }, //  B5
  { midi: 79, label: "5·" }, //  G5
  { midi: 76, label: "3·" }, //  E5
  { midi: 72, label: "1·" }, //  C5
  { midi: 69, label: "6" }, //   A4
  { midi: 65, label: "4" }, //   F4
  { midi: 62, label: "2" }, //   D4
  { midi: 60, label: "1" }, //   C4 — the centre tine
  { midi: 64, label: "3" }, //   E4
  { midi: 67, label: "5" }, //   G4
  { midi: 71, label: "7" }, //   B4
  { midi: 74, label: "2·" }, //  D5
  { midi: 77, label: "4·" }, //  F5
  { midi: 81, label: "6·" }, //  A5
  { midi: 84, label: "1··" }, // C6
  { midi: 88, label: "3··" } //  E6
];

export const kalimba = {
  id: "kalimba",
  name: { zh: "卡林巴", en: "Kalimba" },
  category: "other",
  tuning: {
    layout: "list",
    defaultPresetId: "c17",
    presets: [
      {
        id: "c17",
        name: { zh: "17 音 C 调", en: "17-key, key of C" },
        notes: TINES.map((tine) => tine.midi),
        noteLabels: TINES.map((tine) => ({ zh: tine.label, en: tine.label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
