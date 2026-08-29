/**
 * Tempo maths. BPM always counts `beatUnit` notes, so a meter whose
 * denominator differs from the beat unit simply scales the pulse length.
 */

import type { Meter, Denominator } from "./meter.js";
import { meterPulses } from "./meter.js";

export interface Tempo {
  bpm: number;
  /** The note value one BPM click represents (4 = quarter). */
  beatUnit: Denominator;
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;

/** Tap gaps longer than this start a fresh measurement. */
const TAP_RESET_MS = 3000;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Duration of one meter pulse (one `meter.denominator` note) in seconds. */
export function pulseSeconds(tempo: Tempo, meter: Meter): number {
  return (60 / tempo.bpm) * (tempo.beatUnit / meter.denominator);
}

export function barSeconds(tempo: Tempo, meter: Meter): number {
  return pulseSeconds(tempo, meter) * meterPulses(meter);
}

/**
 * BPM from a list of tap timestamps (ms). Only the taps since the last
 * long gap count, and at least two are needed.
 */
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;

  let start = 0;
  for (let index = 1; index < taps.length; index += 1) {
    if (taps[index] - taps[index - 1] > TAP_RESET_MS) start = index;
  }

  const recent = taps.slice(start);
  if (recent.length < 2) return null;

  const span = recent[recent.length - 1] - recent[0];
  if (span <= 0) return null;
  return clampBpm(60000 / (span / (recent.length - 1)));
}
