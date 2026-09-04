/**
 * The pitch track: the same history the spectrogram draws, read as one
 * value per column instead of a band of energy.
 *
 * Three things are specific to drawing pitch as a line and have no
 * equivalent in the spectrogram layer: a line must break where the singer
 * breathed, a line makes octave detection errors look like real leaps, and
 * a line is what a vocal range is measured from.
 */

import { frequencyToMidi, frequencyToNote, midiToFrequency } from "./music-theory.js";
import type { SpectrogramColumn } from "./spectrogram.js";

export interface SegmentOptions {
  /** A larger hole than this starts a new segment even if both sides are voiced. */
  maxGapSeconds?: number;
  /** Segments shorter than this are detector speckle, not notes. */
  minColumns?: number;
}

/**
 * Split a track into continuously voiced runs. Never interpolate across a
 * gap: one polyline through a breath renders as a glissando nobody sang.
 */
export function pitchSegments(
  columns: readonly SpectrogramColumn[],
  options: SegmentOptions = {}
): SpectrogramColumn[][] {
  const maxGap = options.maxGapSeconds ?? 0.2;
  const minColumns = options.minColumns ?? 2;
  const segments: SpectrogramColumn[][] = [];
  let current: SpectrogramColumn[] = [];

  const flush = (): void => {
    if (current.length >= minColumns) segments.push(current);
    current = [];
  };

  for (const column of columns) {
    if (column.pitchHz === null || !Number.isFinite(column.pitchHz)) {
      flush();
      continue;
    }
    const previous = current[current.length - 1];
    if (previous && column.time - previous.time > maxGap) flush();
    current.push(column);
  }
  flush();
  return segments;
}

export interface OctaveOptions {
  /** How close to a whole octave a jump must be to count as an artefact. */
  toleranceSemitones?: number;
  /** Columns the new octave must hold for before it is believed. */
  sustainColumns?: number;
}

/**
 * Fold one-off octave errors back onto the line.
 *
 * Halving and doubling are the dominant artefacts on voice, and on a
 * semitone axis they draw as a clean 12-semitone step — indistinguishable
 * from a real leap unless you use the thing that separates them: a real
 * leap is *held*, an artefact lasts a frame or two.
 */
export function correctOctaveJumps(
  columns: readonly SpectrogramColumn[],
  options: OctaveOptions = {}
): SpectrogramColumn[] {
  const tolerance = options.toleranceSemitones ?? 1.5;
  const sustain = options.sustainColumns ?? 3;
  const result = columns.map((column) => ({ ...column }));
  let anchor: number | null = null;

  for (let i = 0; i < result.length; i += 1) {
    const pitch = result[i].pitchHz;
    if (pitch === null || !Number.isFinite(pitch)) {
      anchor = null;
      continue;
    }
    if (anchor === null) {
      anchor = pitch;
      continue;
    }

    const shift = frequencyToMidi(pitch) - frequencyToMidi(anchor);
    const octaves = Math.round(shift / 12);
    const isOctaveJump = octaves !== 0 && Math.abs(shift - octaves * 12) <= tolerance;

    if (isOctaveJump && !holdsFor(result, i, anchor, octaves, sustain, tolerance)) {
      result[i].pitchHz = pitch / Math.pow(2, octaves);
      continue;
    }
    anchor = result[i].pitchHz;
  }
  return result;
}

/** Does the same octave offset persist for `sustain` columns from `start`? */
function holdsFor(
  columns: readonly SpectrogramColumn[],
  start: number,
  anchor: number,
  octaves: number,
  sustain: number,
  tolerance: number
): boolean {
  let held = 0;
  for (let i = start; i < columns.length && held < sustain; i += 1) {
    const pitch = columns[i].pitchHz;
    if (pitch === null || !Number.isFinite(pitch)) break;
    const shift = frequencyToMidi(pitch) - frequencyToMidi(anchor);
    if (Math.abs(shift - octaves * 12) > tolerance) break;
    held += 1;
  }
  return held >= sustain;
}

export interface RangeEnd {
  hz: number;
  midi: number;
  /** Note name with octave, e.g. "A3". */
  name: string;
}

export interface VocalRange {
  lowest: RangeEnd;
  highest: RangeEnd;
  /** Whole semitones between the two ends. */
  semitones: number;
}

export interface RangeOptions {
  /** Fewer voiced columns than this is not a measurement. */
  minColumns?: number;
  /** Fraction trimmed from each end, so onset scoops do not widen the range. */
  trim?: number;
  tuning?: number;
}

/** The sustained extremes of a take — a singer's range, not their accidents. */
export function vocalRange(
  columns: readonly SpectrogramColumn[],
  options: RangeOptions = {}
): VocalRange | null {
  const minColumns = options.minColumns ?? 12;
  const trim = options.trim ?? 0.05;
  const tuning = options.tuning ?? 440;

  const midis = columns
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null && Number.isFinite(hz) && hz > 0)
    .map((hz) => frequencyToMidi(hz, tuning))
    .sort((a, b) => a - b);

  if (midis.length < minColumns) return null;

  const lowIndex = Math.min(midis.length - 1, Math.floor(midis.length * trim));
  const highIndex = Math.max(0, Math.ceil((midis.length - 1) * (1 - trim)));
  const low = end(midis[lowIndex], tuning);
  const high = end(midis[highIndex], tuning);
  return { lowest: low, highest: high, semitones: high.midi - low.midi };
}

function end(midiFloat: number, tuning: number): RangeEnd {
  const midi = Math.round(midiFloat);
  const hz = midiToFrequency(midi, tuning);
  const note = frequencyToNote(hz, tuning);
  return { hz, midi, name: `${note.name}${note.octave}` };
}
