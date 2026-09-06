/**
 * Timbres: what an instrument sounds like, as data.
 *
 * A timbre is a note-independent description — waveform, partials,
 * envelope, filter — and `timbreSpec()` binds it to one pitch and one
 * length. Keeping the two apart is what lets a keyboard, the ear trainer
 * and a fretboard share one sound set: they differ in which notes they
 * ask for, never in how a note is built.
 *
 * This is the same shape the metronome's `SOUND_BANKS` already has, moved
 * down to `audio/` because playing is a both-directions concern and two
 * features may not import each other.
 */

import { midiToFrequency } from "../lib/music-theory.js";
import type { VoiceFilter, VoiceSpec, Waveform } from "./voice.js";

/** Closed set: the dictionary carries a `timbre.<id>` for each. */
export type TimbreId = "singable";

export interface Timbre {
  id: TimbreId;
  waveform: Waveform;
  /** Peak gain, 0..1. */
  gain: number;
  /** Relative gains of harmonics 2..n. */
  partials?: number[];
  attack?: number;
  /**
   * Seconds the note rings on its own when nothing ends it. For a pluck
   * this is the whole decay; for a sustaining timbre it only bounds the
   * filter sweep.
   */
  ring?: number;
  /** Present for sustaining timbres (organ, bowed); absent means a pluck. */
  sustain?: number;
  decay?: number;
  release?: number;
  /**
   * Filter cutoff as a multiple of the note's own frequency, so the same
   * timbre stays balanced across the whole range instead of going dull in
   * the bass and shrill on top.
   */
  filter?: Omit<VoiceFilter, "frequency"> & { harmonic: number };
}

export const TIMBRES: Timbre[] = [
  {
    // The ear trainer's tone: a bare sine is hard to hear an interval in.
    id: "singable",
    waveform: "sine",
    gain: 0.32,
    attack: 0.02,
    partials: [0.34, 0.16, 0.07]
  }
];

export const DEFAULT_TIMBRE_ID: TimbreId = "singable";

export function getTimbre(id: string): Timbre {
  return TIMBRES.find((entry) => entry.id === id) ?? TIMBRES[0];
}

/** How long a note of this timbre rings when nothing stops it. */
export const DEFAULT_RING_SECONDS = 3;

/** Bind a timbre to one pitch and one length. */
export function timbreSpec(
  timbre: Timbre,
  midi: number,
  duration: number,
  tuning = 440
): VoiceSpec {
  const frequency = midiToFrequency(midi, tuning);
  return {
    waveform: timbre.waveform,
    frequency,
    gain: timbre.gain,
    duration,
    attack: timbre.attack,
    partials: timbre.partials,
    sustain: timbre.sustain,
    decay: timbre.decay,
    release: timbre.release,
    filter: timbre.filter
      ? {
          type: timbre.filter.type,
          q: timbre.filter.q,
          envelope: timbre.filter.envelope,
          frequency: frequency * timbre.filter.harmonic
        }
      : undefined
  };
}
