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
export type TimbreId = "piano" | "epiano" | "organ" | "singable";

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

/**
 * The keyboard family, in synthesis only.
 *
 * What separates these is not the waveform — it is the envelope and how
 * the brightness behaves. A struck string is loud, bright and immediately
 * decaying; a tine is the same gesture with a thinner spectrum; an organ
 * pipe has no decay at all because the air never stops. So piano and
 * e-piano have no `sustain` (they are plucks, and the key release only
 * damps what is left) while the organ holds its level until let go.
 */
export const TIMBRES: Timbre[] = [
  {
    // Hammer on string: near-instant attack, a long decay, and a spectrum
    // that dulls as the note dies — the filter envelope is doing that.
    id: "piano",
    waveform: "triangle",
    gain: 0.3,
    attack: 0.004,
    ring: 4,
    release: 0.12,
    partials: [0.5, 0.28, 0.16, 0.09, 0.05],
    filter: { type: "lowpass", harmonic: 8, q: 0.7, envelope: 3 }
  },
  {
    // A tine, not a string: a strong upper partial over a weak fundamental
    // is what makes an electric piano read as bell-like.
    id: "epiano",
    waveform: "sine",
    gain: 0.34,
    attack: 0.006,
    ring: 3.2,
    release: 0.16,
    partials: [0.12, 0.55, 0.08, 0.22, 0.04],
    filter: { type: "lowpass", harmonic: 6, q: 0.6, envelope: 2.5 }
  },
  {
    // Drawbars: fixed harmonics that never decay. The gain is low because
    // six partials at once add up.
    id: "organ",
    waveform: "sine",
    gain: 0.18,
    attack: 0.012,
    decay: 0.04,
    sustain: 0.92,
    release: 0.07,
    ring: 1,
    partials: [0.7, 0.5, 0.6, 0.25, 0.4, 0.2]
  },
  {
    // The ear trainer's tone: a bare sine is hard to hear an interval in.
    id: "singable",
    waveform: "sine",
    gain: 0.32,
    ring: 2,
    attack: 0.02,
    partials: [0.34, 0.16, 0.07]
  }
];

export const DEFAULT_TIMBRE_ID: TimbreId = "piano";

export function getTimbre(id: string): Timbre {
  return (
    TIMBRES.find((entry) => entry.id === id) ??
    TIMBRES.find((entry) => entry.id === DEFAULT_TIMBRE_ID)!
  );
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
