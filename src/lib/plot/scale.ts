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

const FREQUENCY_TICKS = [
  20, 30, 50, 80, 100, 200, 300, 500, 800, 1000, 2000, 3000, 5000, 8000, 10000, 15000
];

/** Decade-ish frequency gridlines inside the scale's domain. */
export function frequencyTicks(scale: Scale): Tick[] {
  const [min, max] = scale.domain;
  return FREQUENCY_TICKS.filter((value) => value >= min && value <= max).map((value) => ({
    value,
    position: scale.position(value),
    label: value >= 1000 ? `${value / 1000}k` : `${value}`,
    accidental: false
  }));
}

/**
 * One tick per note. Wide ranges would produce an unreadable comb, so
 * accidentals drop out first and then whole octaves, keeping the label
 * count bounded no matter how much range is on screen.
 */
export function semitoneTicks(scale: Scale, tuning = 440): Tick[] {
  const lowMidi = Math.round(frequencyToMidi(scale.domain[0], tuning));
  const highMidi = Math.round(frequencyToMidi(scale.domain[1], tuning));
  const span = highMidi - lowMidi;
  const step = span > 60 ? 12 : span > 24 ? 2 : 1;
  const naturalsOnly = span > 24;

  const ticks: Tick[] = [];
  for (let midi = lowMidi; midi <= highMidi; midi += 1) {
    const pitchClass = ((midi % 12) + 12) % 12;
    const name = NOTE_NAMES[pitchClass];
    const accidental = name.length > 1;
    if (naturalsOnly && accidental) continue;
    if (step > 1 && (midi - lowMidi) % step !== 0 && midi !== highMidi) continue;
    const value = midiToFrequency(midi, tuning);
    ticks.push({
      value,
      position: scale.position(value),
      label: `${name}${Math.floor(midi / 12) - 1}`,
      accidental
    });
  }
  return ticks;
}
