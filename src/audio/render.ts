/**
 * Turning a physical model into samples the graph can play.
 *
 * The model itself lives in `lib/voice-model.ts` and knows nothing about
 * Web Audio: it takes a frequency and gives back a `Float32Array`. This is
 * the adapter — it decides how long to render, binds the model to a pitch,
 * wraps the result in an `AudioBuffer`, and remembers what it already
 * built.
 *
 * The cache is what makes this affordable. Rendering a four-second note is
 * a few milliseconds of arithmetic, which is nothing once and a stutter
 * thirty-two times in a row; a player running a scale would hear every
 * note pay it again. Keyed by voice and pitch, bounded so a long session
 * cannot grow without limit, and evicted least-recently-used — the notes a
 * player is actually playing are the ones that stay.
 */

import {
  renderDrum,
  renderModal,
  renderString,
  renderWind,
  type DrumSpec,
  type ModalSpec,
  type RandomSource,
  type StringSpec,
  type WindSpec
} from "../lib/voice-model.js";

/**
 * How a model's timescales move with pitch.
 *
 * A model is rendered one note at a time, so the note is context rather
 * than data — but the ways an instrument changes across its range are
 * facts about the instrument. Without them a rendered scale dies at the
 * same rate from bottom to top and every note sounds like the same string
 * with the pitch changed, which no instrument does.
 */
export interface PitchTilt {
  /** How much longer a note rings per octave below A4. */
  ringTilt?: number;
  /** How much more damped a note is per octave above A4. */
  dampingTilt?: number;
}

/** A model, minus the facts the renderer supplies per note. */
export type VoiceModel = PitchTilt &
  (
    | ({ kind: "string" } & Omit<StringSpec, "frequency" | "sampleRate" | "seconds">)
    | ({ kind: "modal" } & Omit<ModalSpec, "frequency" | "sampleRate" | "seconds">)
    | ({ kind: "drum" } & Omit<DrumSpec, "sampleRate" | "seconds">)
    | ({ kind: "wind" } & Omit<WindSpec, "frequency" | "sampleRate" | "seconds">)
  );

/** The model with its two timescales moved to where this note sits. */
function tuneToPitch(model: VoiceModel, midi: number): VoiceModel {
  const octaves = (69 - midi) / 12;
  const ring = Math.pow(2, (model.ringTilt ?? 0) * octaves);
  const damping = Math.pow(2, (model.dampingTilt ?? 0) * octaves);

  if (model.kind === "string") {
    return {
      ...model,
      ring: model.ring * ring,
      damping: Math.min(0.95, model.damping * damping)
    };
  }
  if (model.kind === "modal") {
    return { ...model, ring: model.ring.map((value) => value * ring) };
  }
  if (model.kind === "wind") {
    // A wind has no `ring` to tilt: it is driven for as long as it is
    // blown, and what changes across the range is the tube, not the decay.
    return model;
  }
  return {
    ...model,
    modes: model.modes.map((mode) => ({ ...mode, ring: mode.ring * ring })),
    noises: model.noises?.map((band) => ({ ...band, ring: band.ring * ring }))
  };
}

/**
 * The same drum, at the pitch this one is tuned to. A model is a shape at
 * a reference frequency, so a kit piece is its own pitch plus that shape.
 */
function tunedTo(model: VoiceModel, frequency: number): VoiceModel {
  if (model.kind !== "drum") return model;
  const scale = frequency / model.tone;
  if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return model;
  return {
    ...model,
    modes: model.modes.map((mode) => ({ ...mode, hz: mode.hz * scale, ratio: mode.ratio })),
    noises: model.noises?.map((band) => ({ ...band, hz: band.hz * scale }))
  };
}

/**
 * How long a note is rendered for, at most. Four seconds is longer than
 * any note this app plays rings for, and short enough that a cache of them
 * is measured in tens of megabytes rather than hundreds.
 */
export const MAX_RENDER_SECONDS = 4;

/** Notes kept rendered at once. Enough for a keyboard's span, and then some. */
export const CACHE_LIMIT = 64;

/** How long a blown note is rendered for. Longer than anyone holds one. */
const WIND_HOLD_SECONDS = 3;

/**
 * What a note should measure, in the window the ear integrates loudness
 * over, and the most it may reach at any instant.
 *
 * Peak-normalising every voice is what made this necessary. A pluck is a
 * brief burst with a tall peak and little energy under it; a bowed note is
 * the opposite. Scale both to the same peak and the sustain comes out
 * twenty-odd decibels louder — which is exactly what a player hears when
 * they strum a chord and then blow a flute.
 *
 * So loudness is the target and the peak is only a ceiling. A voice whose
 * transient is too tall to reach the target is left where the ceiling puts
 * it: loud, which is what a transient is, rather than clipped.
 */
export const LOUDNESS = 0.16;
export const PEAK_CEILING = 0.92;
export const LOUDNESS_WINDOW = 0.2;

/**
 * Bring a rendered note to a level a listener calls the same.
 *
 * Done here rather than in the model because it is about playback rather
 * than about physics: the model's own dynamics — blowing harder is louder,
 * a bass string rings longer — are the model's business, and this only
 * decides how loud the result is. Measuring the model instead of the
 * speaker is also what lets a test render two pressures and check that one
 * is louder than the other.
 */
function calibrate(samples: Float32Array, sampleRate: number): void {
  const window = Math.min(samples.length, Math.max(1, Math.round(LOUDNESS_WINDOW * sampleRate)));
  let sum = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    if (index < window) sum += value * value;
    const size = Math.abs(value);
    if (size > peak) peak = size;
  }
  const rms = Math.sqrt(sum / window);
  if (peak <= 0 || rms <= 0) return;

  const scale = Math.min(LOUDNESS / rms, PEAK_CEILING / peak);
  for (let index = 0; index < samples.length; index += 1) samples[index] *= scale;
}

const cache = new Map<string, AudioBuffer>();

/** How long this model should be rendered for: its own life, capped. */
export function modelSeconds(model: VoiceModel): number {
  if (model.kind === "string") return Math.min(model.ring * 1.4 + 0.3, MAX_RENDER_SECONDS);
  if (model.kind === "modal") return Math.min(Math.max(...model.ring) * 1.2 + 0.2, MAX_RENDER_SECONDS);
  // A wind is driven, so it has no life of its own to measure: it lasts as
  // long as the air does, and the player's finger is what ends it.
  if (model.kind === "wind") return WIND_HOLD_SECONDS;
  const rings = [
    ...model.modes.map((mode) => mode.ring),
    ...(model.noises ?? []).map((band) => band.ring)
  ];
  return Math.min(Math.max(0.05, ...rings) * 1.4 + 0.1, MAX_RENDER_SECONDS);
}

/**
 * A random source for the renderer. Every note gets its own, seeded from
 * the note itself, so a held chord does not sound like one excitation
 * copied — two strings are never excited by the same noise.
 */
function noteRandom(seed: number): RandomSource {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Render one note of a physical model. `key` identifies it in the cache —
 * a voice id plus the pitch, so the same note twice is rendered once.
 */
export function renderVoice(
  context: BaseAudioContext,
  base: VoiceModel,
  key: string,
  midi: number,
  frequency: number
): AudioBuffer {
  const cached = cache.get(key);
  if (cached) {
    // Touch it, so the notes in play are the ones that survive eviction.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const model = tunedTo(tuneToPitch(base, midi), frequency);
  const sampleRate = context.sampleRate;
  const seconds = modelSeconds(model);
  const seed = Math.round(frequency * 100) + model.kind.length * 7919;

  let samples: Float32Array;
  if (model.kind === "string") {
    samples = renderString({ ...model, frequency, sampleRate, seconds }, noteRandom(seed));
  } else if (model.kind === "wind") {
    samples = renderWind({ ...model, frequency, sampleRate, seconds }, noteRandom(seed));
  } else if (model.kind === "modal") {
    samples = renderModal({
      ...model,
      frequency,
      sampleRate,
      seconds,
      random: noteRandom(seed)
    });
  } else {
    samples = renderDrum({ ...model, sampleRate, seconds }, noteRandom(seed));
  }

  calibrate(samples, sampleRate);

  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);

  cache.set(key, buffer);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return buffer;
}

/** Drop everything rendered. Used when the context that made it goes away. */
export function clearRenderedVoices(): void {
  cache.clear();
}

/** How many notes are currently rendered. For tests and diagnostics. */
export function renderedCount(): number {
  return cache.size;
}
