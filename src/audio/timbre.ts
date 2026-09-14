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
  // Keys
  | "piano"
  | "epiano"
  | "organ"
  // Plucked, one voice each: a body's size and material is what makes a
  // banjo a banjo, and sharing a voice between two of them is how eight
  // instruments end up sounding like two.
  | "guitar"
  | "mandolin"
  | "banjo"
  | "ukulele"
  | "pipa"
  | "ruan"
  | "liuqin"
  | "guzheng"
  | "guqin"
  | "bass"
  // Bowed
  | "violin"
  | "viola"
  | "cello"
  | "contrabass"
  | "erhu"
  | "zhonghu"
  | "gaohu"
  // Winds
  | "dizi"
  | "xiao"
  | "saxophone"
  | "harmonica"
  // Other
  | "kalimba"
  // Percussion
  | "kick"
  | "snare"
  | "hihat"
  | "hihatOpen"
  | "tom"
  | "crash"
  | "ride"
  // The ear trainer's own tone, and only that.
  | "singable";

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
    // A tine is a bar, not a string, so its partials are inharmonic — the
    // 1 : 6.27 : 17.5 of a bar clamped at one end, which is why a kalimba
    // sounds like a music box and a guitar does not.
    id: "kalimba",
    waveform: "sine",
    gain: 0.5,
    attack: 0.002,
    ring: 1.6,
    model: {
      kind: "modal",
      ratios: [1, 6.27, 17.5],
      ring: [1.6, 0.35, 0.12],
      levels: [1, 0.16, 0.05],
      // A thumb, not a hammer: the click of the nail is most of the attack.
      noise: { level: 0.16, hz: 3400, q: 1, ring: 0.012 },
      ringTilt: 0.12,
      body: [{ hz: 250, q: 1.2, db: 4 }],
      gain: 0.5
    }
  },
  {
    // A free reed: closed at the reed end, so like a clarinet it holds the
    // odd harmonics and overblows a twelfth. The buzz is the reed itself,
    // which is why the jet is more turbulence than stream.
    id: "harmonica",
    waveform: "sawtooth",
    gain: 0.5,
    attack: 0.02,
    ring: 1.2,
    model: {
      kind: "wind",
      attack: 0.02,
      stopped: true,
      jet: { pressure: 0.58, noise: 0.35, tone: 0.5, damping: 0.3 },
      breath: 0.05,
      body: [
        { hz: 700, q: 1.4, db: 6 },
        { hz: 1800, q: 1.3, db: 5 },
        { hz: 3600, q: 1.1, db: 3 }
      ],
      gain: 0.6
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
    // A big steel-strung box. Its air resonance near 105Hz is what a strum
    // has that a banjo has not.
    id: "guitar",
    waveform: "sawtooth",
    gain: 0.8,
    attack: 0.003,
    ring: 3.2,
    model: {
      kind: "string",
      ring: 3.2,
      ringTilt: 0.3,
      damping: 0.4,
      dampingTilt: 0.18,
      stiffness: 0.32,
      pluckPosition: 0.18,
      brightness: 0.78,
      body: [{ hz: 105, q: 1.3, db: 6 }, { hz: 205, q: 1.6, db: 4 }, { hz: 2600, q: 0.9, db: 3 }],
      gain: 0.8
    }
  },
  {
    // Half the box of a guitar and paired courses: the same strings, an
    // octave of body higher, and gone in half the time.
    id: "mandolin",
    waveform: "sawtooth",
    gain: 0.8,
    attack: 0.003,
    ring: 2.4,
    model: {
      kind: "string",
      ring: 2.4,
      ringTilt: 0.26,
      damping: 0.45,
      dampingTilt: 0.16,
      stiffness: 0.3,
      pluckPosition: 0.15,
      brightness: 0.85,
      body: [{ hz: 220, q: 1.5, db: 7 }, { hz: 480, q: 1.7, db: 5 }, { hz: 3200, q: 1, db: 4 }],
      gain: 0.8
    }
  },
  {
    // Steel strings over a drumhead on a stick. Almost no box at all, so
    // what is left is a fast decay and a hard, high resonance.
    id: "banjo",
    waveform: "sawtooth",
    gain: 0.8,
    attack: 0.003,
    ring: 1.7,
    model: {
      kind: "string",
      ring: 1.7,
      ringTilt: 0.22,
      damping: 0.55,
      dampingTilt: 0.14,
      stiffness: 0.28,
      pluckPosition: 0.12,
      brightness: 0.9,
      body: [{ hz: 330, q: 1.8, db: 8 }, { hz: 620, q: 1.6, db: 5 }, { hz: 3800, q: 1, db: 6 }],
      gain: 0.8
    }
  },
  {
    // A small nylon-strung box: little air to move, so the body sits high
    // and the note is gone almost as soon as it arrives.
    id: "ukulele",
    waveform: "triangle",
    gain: 0.8,
    attack: 0.003,
    ring: 1.8,
    model: {
      kind: "string",
      ring: 1.8,
      ringTilt: 0.24,
      damping: 0.55,
      dampingTilt: 0.14,
      stiffness: 0.2,
      pluckPosition: 0.28,
      brightness: 0.5,
      body: [{ hz: 250, q: 1.3, db: 5 }, { hz: 520, q: 1.5, db: 4 }, { hz: 2200, q: 0.9, db: 2 }],
      gain: 0.8
    }
  },
  {
    // A pear-shaped box and steel strings, played with the nail: bright,
    // hard, and gone — which is the whole attack of the instrument.
    id: "pipa",
    waveform: "sawtooth",
    gain: 0.8,
    attack: 0.003,
    ring: 2.6,
    model: {
      kind: "string",
      ring: 2.6,
      ringTilt: 0.3,
      damping: 0.38,
      dampingTilt: 0.18,
      stiffness: 0.34,
      pluckPosition: 0.14,
      brightness: 0.82,
      body: [{ hz: 180, q: 1.4, db: 6 }, { hz: 420, q: 1.6, db: 4 }, { hz: 3000, q: 1, db: 5 }],
      gain: 0.8
    }
  },
  {
    // A round body with a wide face: warmer and rounder than the pipa
    // beside it, and it rings a little longer.
    id: "ruan",
    waveform: "triangle",
    gain: 0.8,
    attack: 0.003,
    ring: 2.8,
    model: {
      kind: "string",
      ring: 2.8,
      ringTilt: 0.28,
      damping: 0.45,
      dampingTilt: 0.16,
      stiffness: 0.24,
      pluckPosition: 0.26,
      brightness: 0.55,
      body: [{ hz: 140, q: 1.2, db: 5 }, { hz: 330, q: 1.4, db: 4 }, { hz: 1800, q: 0.9, db: 2 }],
      gain: 0.8
    }
  },
  {
    // The smallest of the plucked family and the highest: a tiny box, so
    // its resonance is up where the note is.
    id: "liuqin",
    waveform: "triangle",
    gain: 0.8,
    attack: 0.003,
    ring: 2.0,
    model: {
      kind: "string",
      ring: 2.0,
      ringTilt: 0.24,
      damping: 0.42,
      dampingTilt: 0.16,
      stiffness: 0.26,
      pluckPosition: 0.18,
      brightness: 0.78,
      body: [{ hz: 300, q: 1.5, db: 6 }, { hz: 650, q: 1.6, db: 5 }, { hz: 3600, q: 1, db: 4 }],
      gain: 0.8
    }
  },
  {
    // Twenty-one steel strings over a long paulownia box. The box is big
    // enough to have a low voice of its own and the strings long enough to
    // ring for four seconds.
    id: "guzheng",
    waveform: "sawtooth",
    gain: 0.8,
    attack: 0.003,
    ring: 4.0,
    model: {
      kind: "string",
      ring: 4.0,
      ringTilt: 0.3,
      damping: 0.32,
      dampingTilt: 0.2,
      stiffness: 0.3,
      pluckPosition: 0.22,
      brightness: 0.7,
      body: [{ hz: 95, q: 1.1, db: 7 }, { hz: 190, q: 1.3, db: 5 }, { hz: 1500, q: 0.9, db: 3 }],
      gain: 0.8
    }
  },
  {
    // Silk over thick paulownia. Silk is a lossy, heavy string and the wood
    // is soft: almost no top end, and a note that lasts.
    id: "guqin",
    waveform: "triangle",
    gain: 0.8,
    attack: 0.003,
    ring: 3.6,
    model: {
      kind: "string",
      ring: 3.6,
      ringTilt: 0.32,
      damping: 0.62,
      dampingTilt: 0.12,
      stiffness: 0.18,
      pluckPosition: 0.32,
      brightness: 0.35,
      body: [{ hz: 110, q: 1.1, db: 6 }, { hz: 240, q: 1.3, db: 4 }, { hz: 1200, q: 0.8, db: 2 }],
      gain: 0.8
    }
  },
  {
    // A bass string is nearly a fundamental: the partials that survive are
    // the low ones, and it rings far longer than anything above it.
    id: "bass",
    waveform: "sine",
    gain: 0.9,
    attack: 0.003,
    ring: 4.6,
    model: {
      kind: "string",
      ring: 4.6,
      ringTilt: 0.22,
      damping: 0.3,
      dampingTilt: 0.2,
      stiffness: 0.36,
      pluckPosition: 0.22,
      brightness: 0.62,
      body: [{ hz: 70, q: 1.1, db: 5 }, { hz: 155, q: 1.4, db: 3 }],
      gain: 0.9
    }
  },
  {
    // A violin's own resonances: the air in the box near 290Hz and the wood
    // near 460. They stay put at every pitch, which is most of what makes a
    // violin a violin rather than a sawtooth with a filter on it.
    id: "violin",
    waveform: "sawtooth",
    gain: 0.34,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.24,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 290, q: 2.2, db: 9 }, { hz: 460, q: 2, db: 6 }, { hz: 1100, q: 1.4, db: 4 }, { hz: 2600, q: 1.1, db: 3 }],
      gain: 0.34
    }
  },
  {
    // The same instrument a fifth lower and a size bigger, so every one of
    // its resonances is lower too.
    id: "viola",
    waveform: "sawtooth",
    gain: 0.34,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.24,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 230, q: 2.2, db: 9 }, { hz: 380, q: 2, db: 6 }, { hz: 950, q: 1.4, db: 4 }, { hz: 2200, q: 1.1, db: 3 }],
      gain: 0.34
    }
  },
  {
    // Four times the volume of air: the resonances drop an octave and a half,
    // which is why a cello has a chest and a violin has a point.
    id: "cello",
    waveform: "sawtooth",
    gain: 0.36,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.26,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 130, q: 2.2, db: 9 }, { hz: 260, q: 2, db: 6 }, { hz: 700, q: 1.4, db: 4 }, { hz: 1800, q: 1.1, db: 3 }],
      gain: 0.36
    }
  },
  {
    // The largest box of the family, and the only one tuned in fourths. Its
    // resonances are below the notes it mostly plays.
    id: "contrabass",
    waveform: "sawtooth",
    gain: 0.38,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.28,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 90, q: 2.2, db: 9 }, { hz: 180, q: 2, db: 6 }, { hz: 500, q: 1.4, db: 4 }, { hz: 1400, q: 1.1, db: 3 }],
      gain: 0.38
    }
  },
  {
    // A small soundbox with a snakeskin face: its formants sit far higher
    // than a violin's and ring much harder. That nasality is the instrument,
    // not a fault in it.
    id: "erhu",
    waveform: "sawtooth",
    gain: 0.34,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.2,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 520, q: 2.2, db: 9 }, { hz: 1250, q: 2, db: 6 }, { hz: 2700, q: 1.4, db: 4 }, { hz: 2700, q: 1.1, db: 3 }],
      gain: 0.34
    }
  },
  {
    // The alto of the family: a bigger box, so everything drops.
    id: "zhonghu",
    waveform: "sawtooth",
    gain: 0.34,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.22,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 400, q: 2.2, db: 9 }, { hz: 1000, q: 2, db: 6 }, { hz: 2200, q: 1.4, db: 4 }, { hz: 2200, q: 1.1, db: 3 }],
      gain: 0.34
    }
  },
  {
    // The soprano: a smaller box again, and the brightest of the three.
    id: "gaohu",
    waveform: "sawtooth",
    gain: 0.32,
    attack: 0.07,
    ring: 1,
    model: {
      kind: "string",
      ring: 1,
      ringTilt: 0.1,
      damping: 0.08,
      dampingTilt: 0.1,
      stiffness: 0.18,
      brightness: 0.55,
      attack: 0.07,
      bow: { pressure: 0.5, noise: 0.4 },
      body: [{ hz: 650, q: 2.2, db: 9 }, { hz: 1500, q: 2, db: 6 }, { hz: 3200, q: 1.4, db: 4 }, { hz: 3200, q: 1.1, db: 3 }],
      gain: 0.32
    }
  },
  {
    // A bamboo tube open at both ends and a very small jet: bright, quick to
    // speak, and with almost no box around it to colour anything. What a
    // dizi sounds like is the edge and the air.
    id: "dizi",
    waveform: "sine",
    gain: 0.75,
    attack: 0.05,
    ring: 1.4,
    model: {
      kind: "wind",
      attack: 0.05,
      stopped: false,
      jet: { pressure: 0.5, noise: 0.4, tone: 0.62, damping: 0.3 },
      breath: 0.1,
      body: [
        { hz: 900, q: 1.1, db: 3 },
        { hz: 2400, q: 1, db: 4 },
        { hz: 4200, q: 0.9, db: 2 }
      ],
      gain: 0.75
    }
  },
  {
    // Longer, wider, and blown across the end: the same family as the dizi
    // and half the brightness. More of the sound is air that never entered
    // the tube, which is why a xiao is described as breathy and a dizi is
    // not, even though both are one tube with holes.
    id: "xiao",
    waveform: "sine",
    gain: 0.75,
    attack: 0.07,
    ring: 1.4,
    model: {
      kind: "wind",
      attack: 0.07,
      stopped: false,
      // Breathed, but only so far: past about a tenth of the note's own
      // energy the air stops being a colour and becomes the signal, and
      // the app's own pitch detector can no longer find the note in it —
      // which is a tuner that cannot hear a xiao. What makes it a xiao
      // rather than a dizi is the lower, darker tube below, not the hiss.
      jet: { pressure: 0.5, noise: 0.4, tone: 0.66, damping: 0.4 },
      breath: 0.1,
      body: [
        { hz: 620, q: 1.1, db: 3 },
        { hz: 1600, q: 1, db: 3 },
        { hz: 3000, q: 0.9, db: 1 }
      ],
      gain: 0.75
    }
  },
  {
    // A conical bore closed at the reed: unlike a clarinet's cylinder it
    // overblows the octave and holds every harmonic. The reed is a much
    // rougher jet than a flute's edge — less stream, more turbulence — and
    // the bell gives it the formants that make it a saxophone.
    id: "saxophone",
    waveform: "sawtooth",
    gain: 0.55,
    attack: 0.03,
    ring: 1.2,
    model: {
      kind: "wind",
      attack: 0.03,
      stopped: false,
      jet: { pressure: 0.62, noise: 0.5, tone: 0.35, damping: 0.2 },
      breath: 0.05,
      body: [
        { hz: 800, q: 1.6, db: 8 },
        { hz: 1700, q: 1.5, db: 6 },
        { hz: 3300, q: 1.2, db: 4 }
      ],
      gain: 0.55
    }
  },
  {
    // The ear trainer's tone. It has no model on purpose: an interval is
    // easier to hear in a bare tone than in a guitar, and this is the one
    // voice in the app that is not trying to be an instrument.
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
