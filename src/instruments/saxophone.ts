import type { Fingering, HoleState, InstrumentDefinition, TuningPreset } from "./types.js";
import { NOTE_NAMES } from "../lib/music-theory.js";

/**
 * Saxophone, as a fingering chart of the basic diatonic range.
 *
 * Two things make the sax unlike the flutes here. Its "holes" are keys
 * under the six main fingers, so the chart shows what is pressed rather
 * than what is covered; and it is a transposing instrument, so a written
 * note sounds somewhere else entirely. The tuner hears sounding pitch, so
 * targets are sounding pitches and each one is labelled with the note the
 * player reads.
 *
 * Only the plain fingerings are listed: the palm keys, the bis key and the
 * side keys give alternates for the same pitches and would not be
 * distinguishable in a six-circle diagram.
 */

const C: HoleState = "closed";
const O: HoleState = "open";

/** Written notes of the first octave, low D upward, and their fingerings. */
const BASE_NOTES: Array<{ writtenMidi: number; holes: HoleState[] }> = [
  { writtenMidi: 62, holes: [C, C, C, C, C, C] }, // D4
  { writtenMidi: 64, holes: [C, C, C, C, C, O] }, // E4
  { writtenMidi: 65, holes: [C, C, C, C, O, O] }, // F4
  { writtenMidi: 66, holes: [C, C, C, O, C, O] }, // F♯4 — forked
  { writtenMidi: 67, holes: [C, C, C, O, O, O] }, // G4
  { writtenMidi: 69, holes: [C, C, O, O, O, O] }, // A4
  { writtenMidi: 71, holes: [C, O, O, O, O, O] }, // B4
  { writtenMidi: 72, holes: [O, C, O, O, O, O] }, // C5 — second finger alone
  { writtenMidi: 73, holes: [O, O, O, O, O, O] } //  C♯5
];

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * One preset per size. `transpose` is how far the sounding pitch sits
 * below the written note: a major second for soprano, a major sixth for
 * alto, a major ninth for tenor, an octave and a sixth for baritone.
 */
function saxPreset(
  id: string,
  name: { zh: string; en: string },
  transpose: number
): TuningPreset {
  const notes: number[] = [];
  const noteLabels: Array<{ zh: string; en: string }> = [];
  const fingerings: Fingering[] = [];

  for (const octave of [0, 1]) {
    for (const base of BASE_NOTES) {
      const written = base.writtenMidi + octave * 12;
      notes.push(written - transpose);
      const label = noteName(written);
      noteLabels.push({ zh: label, en: label });
      fingerings.push({ holes: base.holes, keys: octave === 1 ? ["octave"] : undefined });
    }
  }

  return { id, name, notes, noteLabels, fingerings };
}

export const saxophone = {
  id: "saxophone",
  name: { zh: "萨克斯", en: "Saxophone" },
  category: "winds",
  timbre: "reed",
  surface: { kind: "holes" },
  tuning: {
    layout: "fingering",
    defaultPresetId: "alto",
    wind: { holeCount: 6, keyLabels: ["octave"] },
    presets: [
      saxPreset("alto", { zh: "中音 (E♭)", en: "Alto (E♭)" }, 9),
      saxPreset("tenor", { zh: "次中音 (B♭)", en: "Tenor (B♭)" }, 14),
      saxPreset("soprano", { zh: "高音 (B♭)", en: "Soprano (B♭)" }, 2),
      saxPreset("baritone", { zh: "上低音 (E♭)", en: "Baritone (E♭)" }, 21)
    ]
  }
} satisfies InstrumentDefinition;
