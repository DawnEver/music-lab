/**
 * A fretboard is its tuning plus arithmetic.
 *
 * Every fret is one semitone, so a board needs no data of its own beyond
 * the open strings — which the instrument already carries, in every
 * alternate tuning it has. Drop D and DADGAD produce their own boards for
 * free; that is the whole reason the tuning data was worth reusing.
 */

import type { TuningPreset } from "../../../instruments/index.js";

export interface FretPosition {
  /** Index into the rows below, top row first. */
  row: number;
  fret: number;
  midi: number;
}

export interface FretRow {
  /** The instrument's own label for the string (6, 一弦, 内弦…). */
  label: string;
  openMidi: number;
  /** Fret 0 (open) through `frets`. */
  notes: number[];
}

/**
 * Frets that carry an inlay. They mark scale distances, not string
 * numbers, so the same list serves every fretted instrument.
 */
export const MARKER_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
/** Frets marked with a double inlay: the octave and its repeat. */
export const OCTAVE_FRETS = [12, 24];

/**
 * Rows in playing order: the highest-sounding string on top, as tablature
 * is written. The preset's own order is physical, not pitch-sorted (a
 * banjo's fifth string, a ukulele's high G), so it is reversed rather than
 * sorted — reversing preserves the instrument's own arrangement.
 */
export function fretRows(preset: TuningPreset, frets: number, lang: "zh" | "en"): FretRow[] {
  return preset.notes
    .map((openMidi, index) => ({
      label: preset.noteLabels?.[index]?.[lang] ?? String(index + 1),
      openMidi,
      notes: Array.from({ length: frets + 1 }, (_, fret) => openMidi + fret)
    }))
    .reverse();
}

/** The lowest and highest note the board can produce. */
export function fretboardRange(preset: TuningPreset, frets: number): { low: number; high: number } {
  return {
    low: Math.min(...preset.notes),
    high: Math.max(...preset.notes) + frets
  };
}
