import { midiToFrequency, frequencyToMidi } from "./music-theory.js";

export const PITCH_WINDOW = 4096;
export const MIN_PITCH_HZ = 55;
export const MAX_PITCH_HZ = 1400;

/** Detection range bounds; absent fields default to the legacy constants. */
export interface PitchRange {
  minHz?: number;
  maxHz?: number;
  minMidi?: number;
  maxMidi?: number;
}

export interface ResolvedPitchRange {
  minHz: number;
  maxHz: number;
  minMidi: number;
  maxMidi: number;
}

/**
 * Resolve a partial PitchRange to a complete one, keeping the historical
 * defaults (55–1400 Hz, midi 33–96) when nothing is given. Hz and MIDI
 * fields are derived from each other when only one side is provided, so a
 * range is always self-consistent.
 */
export function resolveRange(range: PitchRange | undefined, tuning: number): ResolvedPitchRange {
  const minMidi =
    range?.minMidi ??
    (range?.minHz != null ? Math.floor(frequencyToMidi(range.minHz, tuning)) : 33);
  const maxMidi =
    range?.maxMidi ??
    (range?.maxHz != null ? Math.ceil(frequencyToMidi(range.maxHz, tuning)) : 96);
  const minHz = range?.minHz ?? (range?.minMidi != null ? midiToFrequency(range.minMidi, tuning) : MIN_PITCH_HZ);
  const maxHz = range?.maxHz ?? (range?.maxMidi != null ? midiToFrequency(range.maxMidi, tuning) : MAX_PITCH_HZ);
  return { minHz, maxHz, minMidi, maxMidi };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function calculateRms(buffer: Float32Array): number {
  let sum = 0;
  let mean = 0;
  const start = Math.max(0, buffer.length - PITCH_WINDOW);
  const length = buffer.length - start;

  for (let i = start; i < buffer.length; i += 1) {
    mean += buffer[i];
  }
  mean /= Math.max(1, length);

  for (let i = start; i < buffer.length; i += 1) {
    const centered = buffer[i] - mean;
    sum += centered * centered;
  }

  return Math.sqrt(sum / Math.max(1, length));
}

