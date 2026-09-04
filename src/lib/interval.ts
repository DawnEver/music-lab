/**
 * Intervals: the distance between two pitches, named.
 *
 * Pure data plus lookups. Everything the ear-training exercises need to
 * ask a question is derived from this table, so adding a question type
 * never means adding interval knowledge somewhere else.
 */

/** Closed set: the dictionary carries an `interval.<key>` for each. */
export type IntervalKey =
  | "P1"
  | "m2"
  | "M2"
  | "m3"
  | "M3"
  | "P4"
  | "TT"
  | "P5"
  | "m6"
  | "M6"
  | "m7"
  | "M7"
  | "P8";

export interface Interval {
  key: IntervalKey;
  semitones: number;
  /** Rough ordering for a difficulty ladder: consonances are easier. */
  difficulty: 1 | 2 | 3;
}

export const INTERVALS: Interval[] = [
  { key: "P1", semitones: 0, difficulty: 1 },
  { key: "m2", semitones: 1, difficulty: 3 },
  { key: "M2", semitones: 2, difficulty: 2 },
  { key: "m3", semitones: 3, difficulty: 1 },
  { key: "M3", semitones: 4, difficulty: 1 },
  { key: "P4", semitones: 5, difficulty: 2 },
  { key: "TT", semitones: 6, difficulty: 3 },
  { key: "P5", semitones: 7, difficulty: 1 },
  { key: "m6", semitones: 8, difficulty: 3 },
  { key: "M6", semitones: 9, difficulty: 2 },
  { key: "m7", semitones: 10, difficulty: 3 },
  { key: "M7", semitones: 11, difficulty: 3 },
  { key: "P8", semitones: 12, difficulty: 1 }
];

/** Fold a distance into one octave; the ear names quality before register. */
export function reduceToOctave(semitones: number): number {
  const size = Math.abs(Math.round(semitones));
  if (size <= 12) return size;
  const folded = size % 12;
  return folded === 0 ? 12 : folded;
}

export function intervalBySemitones(semitones: number): Interval | null {
  const size = reduceToOctave(semitones);
  return INTERVALS.find((entry) => entry.semitones === size) ?? null;
}

export function intervalKey(semitones: number): IntervalKey {
  return intervalBySemitones(semitones)?.key ?? "P1";
}

export function semitonesBetween(fromMidi: number, toMidi: number): number {
  return toMidi - fromMidi;
}
