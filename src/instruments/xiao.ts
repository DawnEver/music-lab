import type { InstrumentDefinition } from "./types.js";
import { sixHolePreset } from "./wind-fingerings.js";

/**
 * End-blown bamboo flute, fingered like the dizi but an octave lower and
 * with the top hole on the back for the thumb. G is the common size:
 * do = G4, so 筒音 is D4.
 */
export const xiao: InstrumentDefinition = {
  id: "xiao",
  name: { zh: "箫", en: "Xiao" },
  category: "winds",
  layout: "fingering",
  defaultPresetId: "G",
  wind: { holeCount: 6, backHoles: [1] },
  presets: [
    sixHolePreset("F", { zh: "F 调 (筒音 C4)", en: "Key of F (bottom C4)" }, 60),
    sixHolePreset("G", { zh: "G 调 (筒音 D4)", en: "Key of G (bottom D4)" }, 62),
    sixHolePreset("C", { zh: "C 调 (筒音 G3)", en: "Key of C (bottom G3)" }, 55),
    sixHolePreset("D", { zh: "D 调 (筒音 A3)", en: "Key of D (bottom A3)" }, 57)
  ]
};
