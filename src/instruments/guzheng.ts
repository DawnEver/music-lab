import type { InstrumentDefinition, TuningPreset } from "./types.js";

/**
 * 21-string guzheng, major-pentatonic. Every key shares the same
 * descending offset pattern from the top (1弦) string:
 *   1弦 −3 −2 −3 −2 −2 … repeated over four octaves.
 * Keys are stored ascending (21弦 low → 1弦 high) with labels "21".."1".
 */
const GUZHENG_OFFSETS = [0, 3, 5, 8, 10, 12, 15, 17, 20, 22, 24, 27, 29, 32, 34, 36, 39, 41, 44, 46, 48];

function makeGuzhengPreset(id: string, topMidi: number, name: { zh: string; en: string }): TuningPreset {
  return {
    id,
    name,
    notes: GUZHENG_OFFSETS.map((offset) => topMidi - offset).reverse(),
    noteLabels: Array.from({ length: 21 }, (_, index) => String(21 - index)).map((label) => ({
      zh: label,
      en: label
    }))
  };
}

export const guzheng = {
  id: "guzheng",
  name: { zh: "古筝", en: "Guzheng" },
  category: "plucked",
  tuning: {
    layout: "list",
    defaultPresetId: "dTune",
    presets: [
      makeGuzhengPreset("dTune", 86, { zh: "D 调", en: "Key of D" }), // 1弦 D6 … 21弦 D2
      makeGuzhengPreset("cTune", 84, { zh: "C 调", en: "Key of C" }) //  1弦 C6 … 21弦 C2
    ]
  }
} satisfies InstrumentDefinition;
