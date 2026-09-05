/**
 * Plot scales — the single source of truth for "where does this value sit".
 *
 * A scale maps a domain value to a unit position (0..1) and back, and knows
 * nothing about axes, canvases or pixels. The needle, the instant spectrum,
 * the spectrogram and the pitch track are the same data projected through
 * different scales, so the mapping must exist exactly once: an axis is the
 * renderer's business (x, y, or inverted y), never the scale's.
 */

import { clamp } from "../dsp-core.js";
import { NOTE_NAMES, frequencyToMidi, midiToFrequency } from "../music-theory.js";

export interface Scale {
  /** Domain value -> unit position in 0..1, clamped to the domain. */
  position(value: number): number;
  /** Unit position -> domain value. */
  invert(unit: number): number;
  readonly domain: readonly [number, number];
}

export interface Tick {
  /** Domain value (Hz for frequency scales, seconds for time). */
  value: number;
  position: number;
  label: string;
  /** True for black-key notes, so a renderer can dim or drop them. */
  accidental: boolean;
}

function scaleFrom(
  domain: readonly [number, number],
  forward: (value: number) => number,
  backward: (unit: number) => number
): Scale {
  const [min, max] = domain;
  const low = forward(min);
  const high = forward(max);
  const span = high - low || 1;
  return {
    domain,
    position: (value) => clamp((forward(value) - low) / span, 0, 1),
    invert: (unit) => backward(low + clamp(unit, 0, 1) * span)
  };
}

/** Logarithmic frequency: equal ratios take equal space. */
export function logFrequencyScale(minHz: number, maxHz: number): Scale {
  return scaleFrom([minHz, maxHz], Math.log2, (value) => Math.pow(2, value));
}

/**
 * Semitone frequency: equal *intervals* take equal space, so "a semitone
 * sharp" is the same distance everywhere. This is the scale a singer reads.
 */
export function semitoneScale(minMidi: number, maxMidi: number, tuning = 440): Scale {
  const domain: readonly [number, number] = [
    midiToFrequency(minMidi, tuning),
    midiToFrequency(maxMidi, tuning)
  ];
  return scaleFrom(
    domain,
    (hz) => frequencyToMidi(hz, tuning),
    (midi) => midiToFrequency(midi, tuning)
  );
}

/** Linear seconds. */
export function timeScale(startSeconds: number, endSeconds: number): Scale {
  return scaleFrom([startSeconds, endSeconds], (value) => value, (value) => value);
}

/** Linear decibels, used for both the curve height and the colour ramp. */
export function dbScale(floorDb: number, ceilingDb: number): Scale {
  return scaleFrom([floorDb, ceilingDb], (value) => value, (value) => value);
}

/**
 * How many labels fit in a run of pixels. Ticks that collide are worse
 * than no ticks: overlapping text reads as damage, not as detail.
 */
export function tickBudget(pixels: number, minSpacing = 22): number {
  return Math.max(2, Math.floor(pixels / minSpacing));
}

export interface TickOptions {
  tuning?: number;
  /** Upper bound on labels; the axis thins itself to fit. */
  maxTicks?: number;
}

/** Keep at most `maxTicks`, evenly, always keeping both ends. */
function thin<T>(items: T[], maxTicks: number | undefined): T[] {
  if (!maxTicks || items.length <= maxTicks) return items;
  const step = Math.ceil((items.length - 1) / (maxTicks - 1));
  const kept = items.filter((_, index) => index % step === 0);
  const last = items[items.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
}

const FREQUENCY_TICKS = [
  20, 30, 50, 80, 100, 200, 300, 500, 800, 1000, 2000, 3000, 5000, 8000, 10000, 15000
];

/** Decade-ish frequency gridlines inside the scale's domain. */
export function frequencyTicks(scale: Scale, options: TickOptions = {}): Tick[] {
  const [min, max] = scale.domain;
  const ticks = FREQUENCY_TICKS.filter((value) => value >= min && value <= max).map((value) => ({
    value,
    position: scale.position(value),
    label: value >= 1000 ? `${value / 1000}k` : `${value}`,
    accidental: false
  }));
  return thin(ticks, options.maxTicks);
}

/**
 * One tick per note, thinned until the labels fit.
 *
 * Density is chosen from the space available rather than from the range
 * alone: the same octave is legible on a tall canvas and a smear on a
 * short one. Accidentals drop first, then notes, then whole octaves — and
 * once the step reaches an octave the labels align to C, so what survives
 * reads as a scale rather than as an arbitrary sample.
 */
export function semitoneTicks(scale: Scale, options: TickOptions | number = {}): Tick[] {
  const settings: TickOptions = typeof options === "number" ? { tuning: options } : options;
  const tuning = settings.tuning ?? 440;
  const lowMidi = Math.round(frequencyToMidi(scale.domain[0], tuning));
  const highMidi = Math.round(frequencyToMidi(scale.domain[1], tuning));
  const span = Math.max(1, highMidi - lowMidi);
  const budget = settings.maxTicks ?? Infinity;

  // Without a pixel budget, fall back to the range: a comb of 60 labels is
  // unreadable however much room it has.
  const STEPS = [1, 2, 3, 4, 6, 12, 24, 36];
  const fallbackStep = span > 60 ? 12 : span > 24 ? 2 : 1;
  const step = Number.isFinite(budget)
    ? STEPS.find((candidate) => tickCount(lowMidi, highMidi, candidate) <= budget) ?? 36
    : fallbackStep;
  const naturalsOnly = step > 1 || span > 24;

  const ticks: Tick[] = [];
  // An octave step or wider anchors on C; anything finer starts at the low
  // end so the bottom label is always the bottom of the axis.
  const anchor = step >= 12 ? lowMidi + ((12 - (lowMidi % 12)) % 12) : lowMidi;
  for (let midi = anchor; midi <= highMidi; midi += step) {
    const pitchClass = ((midi % 12) + 12) % 12;
    const name = NOTE_NAMES[pitchClass];
    const accidental = name.length > 1;
    if (naturalsOnly && accidental) continue;
    ticks.push({
      value: midiToFrequency(midi, tuning),
      position: scale.position(midiToFrequency(midi, tuning)),
      label: `${name}${Math.floor(midi / 12) - 1}`,
      accidental
    });
  }
  return thin(ticks, settings.maxTicks);
}

/** How many labels a step would actually print, accidentals included. */
function tickCount(lowMidi: number, highMidi: number, step: number): number {
  let count = 0;
  const anchor = step >= 12 ? lowMidi + ((12 - (lowMidi % 12)) % 12) : lowMidi;
  const naturalsOnly = step > 1 || highMidi - lowMidi > 24;
  for (let midi = anchor; midi <= highMidi; midi += step) {
    if (naturalsOnly && NOTE_NAMES[((midi % 12) + 12) % 12].length > 1) continue;
    count += 1;
  }
  return count;
}
