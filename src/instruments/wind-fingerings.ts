/**
 * Fingering tables shared by the six-hole Chinese flutes.
 *
 * Dizi and xiao are fingered the same way: six holes, played 筒音作5 —
 * with every hole closed the instrument sounds sol, and lifting fingers
 * from the bottom up walks the scale. So a key is one number (the pitch of
 * 筒音) and everything else is this table.
 *
 * Holes are ordered from the blow end downward, so index 5 is the hole a
 * player lifts first.
 */

import type { Fingering, HoleState, TuningPreset } from "./types.js";

const C: HoleState = "closed";
const O: HoleState = "open";

/** Scale degrees above 筒音, and how many holes are open for each. */
const SIX_HOLE_SCALE: Array<{ semitones: number; open: number; degree: string }> = [
  { semitones: 0, open: 0, degree: "5" }, //   sol — 筒音
  { semitones: 2, open: 1, degree: "6" }, //   la
  { semitones: 4, open: 2, degree: "7" }, //   si
  { semitones: 5, open: 3, degree: "1" }, //   do
  { semitones: 7, open: 4, degree: "2" }, //   re
  { semitones: 9, open: 5, degree: "3" }, //   mi
  { semitones: 11, open: 6, degree: "#4" } // #fa — every hole open
];

function holes(open: number): HoleState[] {
  // Fingers lift from the bottom, so the open holes are the last ones.
  return Array.from({ length: 6 }, (_, index) => (index < 6 - open ? C : O));
}

export interface SixHoleNote {
  midi: number;
  fingering: Fingering;
  label: { zh: string; en: string };
}

/**
 * Two octaves from 筒音: the same fingerings, the upper octave overblown.
 * A dot after the degree marks the upper octave, as in 简谱.
 */
export function sixHoleNotes(bottomMidi: number): SixHoleNote[] {
  const notes: SixHoleNote[] = [];
  for (const octave of [0, 1]) {
    for (const step of SIX_HOLE_SCALE) {
      notes.push({
        midi: bottomMidi + step.semitones + octave * 12,
        fingering: {
          holes: holes(step.open),
          keys: octave === 1 ? ["overblow"] : undefined
        },
        label: {
          zh: octave === 1 ? `${step.degree}̇` : step.degree,
          en: octave === 1 ? `${step.degree}̇` : step.degree
        }
      });
    }
  }
  return notes;
}

/** Build a key preset for a six-hole flute from the pitch of 筒音. */
export function sixHolePreset(
  id: string,
  name: { zh: string; en: string },
  bottomMidi: number
): TuningPreset {
  const notes = sixHoleNotes(bottomMidi);
  return {
    id,
    name,
    notes: notes.map((note) => note.midi),
    noteLabels: notes.map((note) => note.label),
    fingerings: notes.map((note) => note.fingering)
  };
}
