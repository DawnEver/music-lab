import type { InstrumentDefinition, TuningPreset } from "./types.js";

/**
 * Guqin, 7 strings (1弦 lowest). The five common 调式 (modes); every
 * variation moves a string by a semitone from 正调:
 *   正调     C2 D2 F2 G2 A2 C3 D3
 *   慢一弦   B1 D2 F2 G2 A2 C3 D3   (1弦降半音, 慢角调)
 *   慢三弦   C2 D2 E2 G2 A2 C3 D3   (3弦降半音, 慢宫调)
 *   紧五弦   C2 D2 F2 G2 B♭2 C3 D3  (5弦升半音, 蕤宾调)
 *   紧二五弦 C2 E♭2 F2 G2 B♭2 C3 D3 (2、5弦升半音, 清商调)
 */
const GUQIN_STRINGS = Array.from({ length: 7 }, (_, index) => ({
  zh: `${"一二三四五六七"[index]}弦`,
  en: String(index + 1)
}));

function makePreset(id: string, name: { zh: string; en: string }, notes: number[]): TuningPreset {
  return { id, name, notes, noteLabels: GUQIN_STRINGS };
}

export const guqin: InstrumentDefinition = {
  id: "guqin",
  name: { zh: "古琴", en: "Guqin" },
  category: "plucked",
  layout: "strings",
  defaultPresetId: "zheng",
  range: { minHz: 55, maxHz: 160, minMidi: 33, maxMidi: 52 },
  presets: [
    makePreset("zheng", { zh: "正调 (仲吕调)", en: "Standard" }, [36, 38, 41, 43, 45, 48, 50]),
    makePreset("man1", { zh: "慢一弦 (慢角调)", en: "Slow 1st string" }, [35, 38, 41, 43, 45, 48, 50]),
    makePreset("man3", { zh: "慢三弦 (慢宫调)", en: "Slow 3rd string" }, [36, 38, 40, 43, 45, 48, 50]),
    makePreset("jin5", { zh: "紧五弦 (蕤宾调)", en: "Tight 5th string" }, [36, 38, 41, 43, 46, 48, 50]),
    makePreset("jin25", { zh: "紧二五弦 (清商调)", en: "Tight 2nd & 5th" }, [36, 39, 41, 43, 46, 48, 50])
  ]
};
