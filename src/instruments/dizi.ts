import type { InstrumentDefinition } from "./types.js";
import { sixHolePreset } from "./wind-fingerings.js";

/**
 * Six-hole bamboo flute. The key is the pitch of do, and 筒音 (every hole
 * closed) sounds sol, a fourth below it — so a D 曲笛 has 筒音 A4. Larger
 * keys (C, D) are 曲笛, higher ones (F, G, A) are 梆笛.
 */
export const dizi = {
  id: "dizi",
  name: { zh: "笛子", en: "Dizi" },
  category: "winds",
  timbre: "flute",
  surface: { kind: "holes" },
  tuning: {
    layout: "fingering",
    defaultPresetId: "D",
    wind: { holeCount: 6 },
    presets: [
      sixHolePreset("C", { zh: "C 调 (筒音 G4)", en: "Key of C (bottom G4)" }, 67),
      sixHolePreset("D", { zh: "D 调 (筒音 A4)", en: "Key of D (bottom A4)" }, 69),
      sixHolePreset("E", { zh: "E 调 (筒音 B4)", en: "Key of E (bottom B4)" }, 71),
      sixHolePreset("F", { zh: "F 调 (筒音 C5)", en: "Key of F (bottom C5)" }, 72),
      sixHolePreset("G", { zh: "G 调 (筒音 D5)", en: "Key of G (bottom D5)" }, 74),
      sixHolePreset("A", { zh: "A 调 (筒音 E5)", en: "Key of A (bottom E5)" }, 76)
    ]
  }
} satisfies InstrumentDefinition;
