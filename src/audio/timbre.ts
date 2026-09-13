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
import type { VoiceModel } from "./render.js";
import type { VoiceFilter, VoiceSpec, Waveform } from "./voice.js";

/** Closed set: the dictionary carries a `timbre.<id>` for each. */
export type TimbreId =
  | "piano"
  | "epiano"
  | "organ"
  | "steel"
  | "nylon"
  | "bass"
  | "singable"
  | "kick"
  | "snare"
  | "hihat"
  | "hihatOpen"
  | "tom"
  | "crash"
  | "ride"
  | "flute"
  | "reed"
  | "bowed"
  | "huqin";

export interface Timbre {
  id: TimbreId;
  waveform: Waveform;
  /** Peak gain, 0..1. */
  gain: number;
  /** Relative gains of harmonics 2..n. */
  partials?: number[];
  attack?: number;
  /**
   * Frequency multiplier reached at the end of the note. A drum is a
   * membrane whose pitch drops as it stops moving; without the drop a kick
   * is just a low beep.
   */
  glide?: number;
  /**
   * Seconds the note rings on its own when nothing ends it. For a pluck
   * this is the whole decay; for a sustaining timbre it only bounds the
   * filter sweep.
   */
  ring?: number;
  /** Present for sustaining timbres (organ, wind); absent means a pluck. */
  sustain?: number;
  /** Relative gain of a noise layer riding on the note — breath. */
  breath?: number;
  decay?: number;
  release?: number;
  /**
   * Filter cutoff as a multiple of the note's own frequency, so the same
   * timbre stays balanced across the whole range instead of going dull in
   * the bass and shrill on top.
   */
  filter?: Omit<VoiceFilter, "frequency"> & { harmonic: number };
  /**
   * How this voice is made, when it is made physically rather than built
   * from an oscillator. A timbre has one or the other, never both: the
   * model already says what the waveform, the envelope and the filter are,
   * and carrying both would leave two answers to the same question.
   *
   * The models are the reason a plucked note stops sounding like a
   * waveform being played. `singable` deliberately has none — the ear
   * trainer wants a clean tone to hear an interval in, not a guitar.
   */
  model?: VoiceModel;
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
    // A bowed string: the same loop as a pluck, with the excitation left
    // on. What makes it read as a violin rather than a sawtooth is the
    // body — a violin's air resonance near 290Hz and its wood resonance
    // near 450 are fixed, and a note played anywhere on the instrument is
    // shaped by them. A filter that transposed with the note would sound
    // like a synth, however good the string underneath it was.
    id: "bowed",
    waveform: "sawtooth",
    gain: 0.75,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.4,
      dampingTilt: 0.1,
      stiffness: 0.24,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [
        { hz: 290, q: 2.2, db: 9 },
        { hz: 460, q: 2, db: 6 },
        { hz: 1100, q: 1.4, db: 4 },
        { hz: 2600, q: 1.1, db: 3 }
      ],
      // A driven string is not scaled to its own peak — that is what makes
      // bowing harder louder — so its level has to be set here instead.
      gain: 0.75
    }
  },
  {
    // The huqin family: a small soundbox with a snakeskin face, so its
    // formants sit higher and ring harder than a violin's. That nasality
    // is the instrument, not a fault in it.
    id: "huqin",
    waveform: "sawtooth",
    gain: 0.68,
    attack: 0.08,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.45,
      dampingTilt: 0.1,
      stiffness: 0.2,
      brightness: 0.6,
      attack: 0.08,
      bow: { pressure: 0.45, noise: 0.45 },
      body: [
        { hz: 520, q: 2.6, db: 10 },
        { hz: 1250, q: 2, db: 8 },
        { hz: 2700, q: 1.5, db: 6 }
      ],
      gain: 0.68
    }
  },
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
    filter: { type: "lowpass", harmonic: 8, q: 0.7, envelope: 3 },
    model: {
      kind: "string",
      ring: 3.6,
      ringTilt: 0.32,
      damping: 0.3,
      dampingTilt: 0.22,
      // A piano's strings are stiff, and the bass ones are the stiffest:
      // their partials are audibly sharp of whole multiples, which is why
      // a piano's low octaves sound rich rather than muddy.
      stiffness: 0.5,
      // The hammer strikes near the end of the string, which is what keeps
      // the fundamental strong and the very high partials out of it.
      pluckPosition: 0.12,
      brightness: 0.9,
      attack: 0.004,
      body: [
        { hz: 110, q: 1.1, db: 5 },
        { hz: 260, q: 1.4, db: 3.5 },
        { hz: 1300, q: 1, db: 2 },
        { hz: 3000, q: 0.9, db: 1.5 }
      ],
      gain: 0.85
    }
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
    filter: { type: "lowpass", harmonic: 6, q: 0.6, envelope: 2.5 },
    // A tine over a tonebar: two bars, not a string. The bell-like upper
    // partials are inharmonic, and they are the whole character — take
    // them away and this is a sine with an envelope on it.
    model: {
      kind: "modal",
      ratios: [1, 2, 4.2, 6.8, 9.6],
      ring: [3.2, 2.2, 1.4, 0.9, 0.5],
      levels: [1, 0.28, 0.45, 0.22, 0.1],
      ringTilt: 0.2,
      noise: { level: 0.1, hz: 3200, q: 0.9, ring: 0.02 },
      gain: 0.5
    }
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
    // A steel string: struck hard and bright, with the top of the spectrum
    // going first. The short attack is the pick, not the string.
    id: "steel",
    waveform: "sawtooth",
    gain: 0.13,
    attack: 0.003,
    ring: 3,
    release: 0.09,
    partials: [0.42, 0.3, 0.2, 0.12, 0.07, 0.04],
    filter: { type: "lowpass", harmonic: 7, q: 0.9, envelope: 4 },
    model: {
      kind: "string",
      ring: 3.2,
      ringTilt: 0.3,
      damping: 0.4,
      dampingTilt: 0.18,
      stiffness: 0.32,
      pluckPosition: 0.18,
      brightness: 0.78,
      body: [
        { hz: 105, q: 1.3, db: 6 },
        { hz: 210, q: 1.6, db: 4 },
        { hz: 2600, q: 0.9, db: 3 }
      ],
      gain: 0.8
    }
  },
  {
    // Nylon and silk: the same gesture with the highs already gone, which
    // is a lower resting cutoff rather than fewer partials.
    id: "nylon",
    waveform: "triangle",
    gain: 0.3,
    attack: 0.008,
    ring: 2.6,
    release: 0.1,
    partials: [0.42, 0.18, 0.09, 0.04],
    filter: { type: "lowpass", harmonic: 4, q: 0.7, envelope: 2.5 },
    model: {
      kind: "string",
      ring: 2.6,
      ringTilt: 0.28,
      damping: 0.52,
      dampingTilt: 0.15,
      stiffness: 0.22,
      // Plucked further from the bridge than a pick would: a fingertip
      // takes the edge off the top before the string ever moves.
      pluckPosition: 0.3,
      brightness: 0.52,
      body: [
        { hz: 125, q: 1.2, db: 4 },
        { hz: 420, q: 1.4, db: 3 },
        { hz: 2000, q: 0.8, db: 1.5 }
      ],
      gain: 0.8
    }
  },
  {
    // A bass string is nearly a fundamental: the partials that survive are
    // the low ones, and it rings far longer than anything above it.
    id: "bass",
    waveform: "sine",
    gain: 0.4,
    attack: 0.006,
    ring: 5,
    release: 0.14,
    partials: [0.45, 0.14, 0.05],
    filter: { type: "lowpass", harmonic: 5, q: 0.8, envelope: 3 },
    model: {
      kind: "string",
      ring: 4.6,
      ringTilt: 0.22,
      damping: 0.3,
      dampingTilt: 0.2,
      stiffness: 0.36,
      pluckPosition: 0.22,
      brightness: 0.62,
      body: [
        { hz: 70, q: 1.1, db: 5 },
        { hz: 155, q: 1.4, db: 3 }
      ],
      gain: 0.9
    }
  },
  {
    // A membrane: one low sine that drops in pitch as it dies. The drop is
    // the whole sound — hold the pitch and it stops being a drum.
    id: "kick",
    waveform: "sine",
    gain: 0.9,
    attack: 0.002,
    glide: 0.45,
    ring: 0.42,
    release: 0.05,
    model: {
      kind: "drum",
      tone: 55,
      modes: [
        { hz: 55, ring: 0.42 },
        { hz: 110, ring: 0.24, level: 0.35 }
      ],
      glide: 0.5,
      noises: [{ hz: 2400, q: 0.7, ring: 0.015, level: 0.3, highpass: true }],
      gain: 0.95
    }
  },
  {
    // Noise across a drumhead. The band, not the envelope, is what
    // separates a snare from a hi-hat.
    id: "snare",
    waveform: "noise",
    gain: 0.5,
    attack: 0.001,
    ring: 0.2,
    release: 0.04,
    // Two bands, because a snare is two things: the head, which is a drum,
    // and the wires, which are metal lying on it. One band cannot be both,
    // and a snare missing either is a tom or a hiss.
    model: {
      kind: "drum",
      tone: 1900,
      modes: [
        { hz: 190, ring: 0.13 },
        { hz: 275, ring: 0.1, level: 0.7 }
      ],
      noises: [
        { hz: 1800, q: 0.6, ring: 0.19, level: 0.85 },
        { hz: 5200, q: 0.6, ring: 0.12, level: 0.45, highpass: true }
      ],
      gain: 0.75
    }
  },
  {
    id: "hihat",
    waveform: "noise",
    gain: 0.32,
    attack: 0.001,
    ring: 0.06,
    release: 0.02,
    model: {
      kind: "drum",
      tone: 8200,
      modes: [],
      noises: [{ hz: 8200, q: 0.5, ring: 0.055, level: 1, highpass: true }],
      gain: 0.5
    }
  },
  {
    // The same metal, undamped: only the ring differs.
    id: "hihatOpen",
    waveform: "noise",
    gain: 0.3,
    attack: 0.001,
    ring: 0.5,
    release: 0.08,
    // The same metal, undamped: only the ring differs.
    model: {
      kind: "drum",
      tone: 8200,
      modes: [],
      noises: [{ hz: 8200, q: 0.4, ring: 0.45, level: 1, highpass: true }],
      gain: 0.5
    }
  },
  {
    // A tuned membrane: less pitch drop than a kick, more body.
    id: "tom",
    waveform: "sine",
    gain: 0.7,
    attack: 0.002,
    glide: 0.7,
    ring: 0.55,
    release: 0.06,
    partials: [0.2],
    // Three modes, because a tom head is tuned and its overtones are not
    // the harmonic series either. Everything scales with the piece's own
    // pitch, so the three toms of the kit are one model at three sizes.
    model: {
      kind: "drum",
      tone: 98,
      modes: [
        { hz: 98, ring: 0.5 },
        { hz: 147, ring: 0.3, level: 0.4 },
        { hz: 196, ring: 0.2, level: 0.2 }
      ],
      glide: 0.75,
      noises: [{ hz: 1200, q: 0.7, ring: 0.02, level: 0.25, highpass: true }],
      gain: 0.9
    }
  },
  {
    id: "crash",
    waveform: "noise",
    gain: 0.26,
    attack: 0.002,
    ring: 1.8,
    release: 0.3,
    model: {
      kind: "drum",
      tone: 5200,
      modes: [{ hz: 390, ring: 1.6, level: 0.25 }],
      noises: [
        { hz: 5200, q: 0.35, ring: 1.9, level: 1, highpass: true },
        { hz: 9500, q: 0.5, ring: 1.2, level: 0.5, highpass: true }
      ],
      gain: 0.4
    }
  },
  {
    id: "ride",
    waveform: "noise",
    gain: 0.22,
    attack: 0.002,
    ring: 1.1,
    release: 0.2,
    model: {
      kind: "drum",
      tone: 6400,
      modes: [
        { hz: 520, ring: 1, level: 0.3 },
        { hz: 880, ring: 0.7, level: 0.2 }
      ],
      noises: [{ hz: 6400, q: 0.5, ring: 1.1, level: 1, highpass: true }],
      gain: 0.45
    }
  },
  {
    // A blown edge: mostly fundamental, held, and audibly breathy. The
    // noise layer is not decoration — take it away and this is a sine.
    id: "flute",
    waveform: "sine",
    gain: 0.3,
    attack: 0.055,
    decay: 0.06,
    sustain: 0.86,
    release: 0.09,
    ring: 1.4,
    breath: 0.1,
    partials: [0.16, 0.06]
  },
  {
    // A reed: odd harmonics through a resonant filter, with less air than
    // a flute because the reed, not the edge, is making the sound.
    id: "reed",
    waveform: "sawtooth",
    gain: 0.12,
    attack: 0.03,
    decay: 0.05,
    sustain: 0.88,
    release: 0.08,
    ring: 1.4,
    breath: 0.05,
    partials: [0.5, 0.42, 0.3, 0.2, 0.12],
    filter: { type: "lowpass", harmonic: 6, q: 1.4, envelope: 2 }
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
  return timbreSpecAt(timbre, midiToFrequency(midi, tuning), duration);
}

/**
 * Bind a timbre to a frequency directly. Percussion needs this: a drum has
 * a fundamental but not a note, and giving it a MIDI number would put it
 * back among things that can be in tune.
 */
export function timbreSpecAt(timbre: Timbre, frequency: number, duration: number): VoiceSpec {
  return {
    waveform: timbre.waveform,
    frequency,
    gain: timbre.gain,
    duration,
    attack: timbre.attack,
    glide: timbre.glide,
    partials: timbre.partials,
    sustain: timbre.sustain,
    breath: timbre.breath,
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
