import type { InstrumentDefinition } from "./types.js";

/**
 * MIDI in physical string order (4弦→1弦). The standard high-G tuning is
 * re-entrant (4th string G4 sits above C4 in pitch), so notes are NOT
 * frequency-sorted here — display order follows the instrument.
 */
export const ukulele = {
  id: "ukulele",
  name: { zh: "尤克里里", en: "Ukulele" },
  category: "plucked",
  timbre: "nylon",
  surface: { kind: "frets", frets: 15 },
  tuning: {
    layout: "list",
    defaultPresetId: "standard",
    presets: [
      {
        id: "standard",
        name: { zh: "标准 (高 G)", en: "Standard (high G)" },
        notes: [67, 60, 64, 69], // G4 C4 E4 A4
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      },
      {
        id: "lowG",
        name: { zh: "Low G", en: "Low G" },
        notes: [55, 60, 64, 69], // G3 C4 E4 A4
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      },
      {
        id: "baritone",
        name: { zh: "上低音 (DGBE)", en: "Baritone (DGBE)" },
        notes: [50, 55, 59, 64], // D3 G3 B3 E4
        noteLabels: ["4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
      }
    ]
  }
} satisfies InstrumentDefinition;
