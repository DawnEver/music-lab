import type { InstrumentDefinition } from "./types.js";

/**
 * 5-string banjo in physical string order (5弦→1弦). The short 5th drone
 * string is re-entrant — it sits above the 4th and 3rd in pitch — so the
 * notes are not frequency-sorted.
 */
export const banjo = {
  id: "banjo",
  name: { zh: "班卓琴", en: "Banjo" },
  category: "plucked",
  timbre: "steel",
  surface: { kind: "frets", frets: 17 },
  tuning: {
    layout: "list",
    defaultPresetId: "openG",
    presets: [
      {
        id: "openG",
        name: { zh: "开放 G", en: "Open G" },
        notes: [67, 50, 55, 59, 62], // g4 D3 G3 B3 D4
        noteLabels: ["5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      },
      {
        id: "doubleC",
        name: { zh: "Double C", en: "Double C" },
        notes: [67, 48, 55, 60, 64], // g4 C3 G3 C4 E4
        noteLabels: ["5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      },
      {
        id: "openD",
        name: { zh: "开放 D", en: "Open D" },
        notes: [69, 50, 57, 62, 66], // a4 D3 A3 D4 F♯4
        noteLabels: ["5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
