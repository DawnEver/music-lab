/**
 * Scoring a sung take against a melody.
 *
 * Two rules matter more than the arithmetic:
 *
 *  - the onset is thrown away. Every singer scoops into a note, and
 *    averaging the scoop in would mark accurate singing as flat.
 *  - an octave transposition is not a pitch error. A bass asked to sing a
 *    line written for a soprano is right, in the wrong register, and the
 *    verdict says which.
 */

import { frequencyToMidi } from "../../../lib/music-theory.js";
import type { SpectrogramColumn } from "../../../lib/spectrogram.js";
import type { Melody, MelodyNote } from "./melody.js";

/** Cents tolerated before a note stops reading as in tune. */
export const GOOD_CENTS = 25;
export const CLOSE_CENTS = 50;
/**
 * Fraction of a note skipped at the start.
 *
 * Two things live there: the scoop into the note, and plain lateness —
 * nobody's attack lands on the millisecond, and a window that begins at
 * the written time is still hearing the previous note. A third of the note
 * is enough to clear both while leaving over half of it to judge.
 */
const ONSET_SKIP = 0.34;
/** Fraction skipped at the end, where the singer is already moving on. */
const RELEASE_SKIP = 0.14;

export type NoteGrade = "good" | "close" | "out" | "missed";

export interface NoteVerdict {
  target: MelodyNote;
  sung: boolean;
  /** Signed deviation in cents, ignoring octave; null when nothing was sung. */
  centsOff: number | null;
  /** Octaves between what was sung and what was written. */
  octaveOff: number;
  grade: NoteGrade;
}

export interface TakeVerdict {
  notes: NoteVerdict[];
  /** 1 for a take entirely in tune, 0 for silence. */
  score: number;
}

const GRADE_POINTS: Record<NoteGrade, number> = {
  good: 1,
  close: 0.6,
  out: 0,
  missed: 0
};

/** Judge one note against the columns that fall inside its window. */
export function judgeNote(
  target: MelodyNote,
  columns: readonly SpectrogramColumn[],
  offset = 0
): NoteVerdict {
  const start = offset + target.start + target.duration * ONSET_SKIP;
  const end = offset + target.start + target.duration * (1 - RELEASE_SKIP);

  const midis = columns
    .filter((column) => column.time >= start && column.time <= end)
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null && Number.isFinite(hz) && hz > 0)
    .map((hz) => frequencyToMidi(hz))
    .sort((a, b) => a - b);

  if (!midis.length) {
    return { target, sung: false, centsOff: null, octaveOff: 0, grade: "missed" };
  }

  // The median is what a listener hears as "the note", and it survives a
  // stray frame in a way a mean does not.
  const median = midis[Math.floor(midis.length / 2)];
  const difference = median - target.midi;
  const octaveOff = Math.round(difference / 12);
  const cents = (difference - octaveOff * 12) * 100;
  const size = Math.abs(cents);

  return {
    target,
    sung: true,
    centsOff: cents,
    octaveOff,
    grade: size <= GOOD_CENTS ? "good" : size <= CLOSE_CENTS ? "close" : "out"
  };
}

/** Judge a whole take. `offset` is when the melody started on the audio clock. */
export function judgeSinging(
  melody: Melody,
  columns: readonly SpectrogramColumn[],
  offset: number
): TakeVerdict {
  const notes = melody.notes.map((note) => judgeNote(note, columns, offset));
  const score = notes.length
    ? notes.reduce((sum, note) => sum + GRADE_POINTS[note.grade], 0) / notes.length
    : 0;
  return { notes, score };
}
