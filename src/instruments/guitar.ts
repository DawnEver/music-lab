import type { InstrumentDefinition } from "./types.js";

/** MIDI, low→high (6弦→1弦). */
export const guitar: InstrumentDefinition = {
  id: "guitar",
  name: { zh: "吉他", en: "Guitar" },
  category: "strings",
  layout: "strings",
  defaultPresetId: "standard",
  // Extremes across all presets: Drop C low C2 (65.4 Hz) … Open G high G4 (392 Hz).
  range: { minHz: 60, maxHz: 420, minMidi: 36, maxMidi: 68 },
  presets: [
    {
      id: "standard",
      name: { zh: "标准调弦", en: "Standard" },
      notes: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "dropD",
      name: { zh: "Drop D", en: "Drop D" },
      notes: [38, 45, 50, 55, 59, 64], // D2 A2 D3 G3 B3 E4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "dropC",
      name: { zh: "Drop C", en: "Drop C" },
      notes: [36, 43, 48, 53, 57, 62], // C2 G2 C3 F3 A3 D4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "dadgad",
      name: { zh: "DADGAD", en: "DADGAD" },
      notes: [38, 45, 50, 55, 57, 62], // D2 A2 D3 G3 A3 D4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "openG",
      name: { zh: "开放 G", en: "Open G" },
      notes: [43, 50, 55, 59, 62, 67], // G2 D3 G3 B3 D4 G4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "openD",
      name: { zh: "开放 D", en: "Open D" },
      notes: [38, 45, 50, 54, 57, 62], // D2 A2 D3 F♯3 A3 D4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    },
    {
      id: "halfDown",
      name: { zh: "半音降调", en: "Half step down" },
      notes: [39, 44, 49, 54, 58, 63], // E♭2 A♭2 D♭3 G♭3 B♭3 E♭4
      noteLabels: ["6", "5", "4", "3", "2", "1"].map((label) => ({ zh: label, en: label }))
    }
  ]
};
