/**
 * Instrument voices, as maths.
 *
 * A string is a delay line with a filter on it. An excitation travels to
 * the bridge, comes back inverted, and loses a little of its top end on
 * every trip; the trips keep landing on each other and what is left is a
 * note. That is the whole of it, and it is why an oscillator sounds
 * electronic while this does not: an oscillator gives every partial the
 * same decay, and a string gives the high ones a far shorter life. The ear
 * reads that difference as "something is resonating" rather than "something
 * is playing a waveform", and no amount of waveform choice buys it back.
 *
 * Everything is rendered here, offline, into a `Float32Array`. Two reasons:
 *
 *  - Web Audio cannot close this loop. A feedback path through a
 *    `DelayNode` is clamped to one 128-sample render quantum, which caps
 *    the loop at about 375Hz — above that the model would stop being a
 *    string and become a buzz. Rendering the samples in plain arithmetic
 *    has no such floor.
 *  - What makes the model right — its pitch, how long it rings, how far
 *    its partials are stretched — becomes something a Node test measures
 *    rather than something a browser has to be trusted about.
 *
 * `lib/` stays pure: no Web Audio, no DOM, no clock. The caller injects
 * the random source, so a note is reproducible.
 */

/** An injected random source, uniform on [0, 1). */
export type RandomSource = () => number;

/** A resonance of the instrument's body, in Hz. A body does not transpose. */
export interface BodyResonance {
  hz: number;
  q: number;
  /** Boost (positive) or cut (negative) at the resonance. */
  db: number;
}

/** The physical facts a plucked or struck string is described by. */
export interface StringSpec {
  frequency: number;
  sampleRate: number;
  /** How much to render. The note's own decay is `ring`. */
  seconds: number;
  /** Seconds for the fundamental to fall 60dB. */
  ring: number;
  /** How much faster the top of the spectrum dies than the bottom, 0..0.9. */
  damping: number;
  /** Where along the string it is excited, 0..1. 0.5 is the middle. */
  pluckPosition?: number;
  /**
   * String stiffness, 0..1. A real string is not perfectly flexible, so
   * its partials sit progressively sharp of whole multiples — a little on
   * a guitar, a lot on a piano's bass. A perfectly flexible string is the
   * one thing no instrument has ever been.
   */
  stiffness?: number;
  /** How bright the excitation is, 0..1. A pick is bright, a thumb is not. */
  brightness?: number;
  /** Seconds the excitation takes to arrive. A hammer is not instant. */
  attack?: number;
  /** The body it is strung on. */
  body?: BodyResonance[];
  /**
   * Present when the string is bowed rather than plucked.
   *
   * A bow is not a pluck that lasts longer. It feeds energy into the
   * string continuously, so the excitation is never finished and the note
   * holds for as long as the bow moves — take the bow away and what is
   * left is a string ringing down, which is what letting go sounds like.
   */
  bow?: {
    /** How hard it presses, 0..1. More pressure, more energy in. */
    pressure: number;
    /** How much of that energy is the hair's own noise. */
    noise: number;
  };
  gain?: number;
}

/** A struck bar or tine: a handful of modes that share an onset, not a string. */
export interface ModalSpec {
  frequency: number;
  sampleRate: number;
  seconds: number;
  /**
   * Partial ratios. A string's are 1, 2, 3…; a bar's are inharmonic — the
   * 1 : 2.76 : 5.4 of a free-free bar is why a glockenspiel is not a piano.
   */
  ratios: number[];
  /** Seconds to -60dB, per ratio. The last value repeats for any remainder. */
  ring: number[];
  /** Relative level per ratio, same length rule as `ring`. */
  levels?: number[];
  /** How much the partials are stretched sharp of `ratios`, 0..1. */
  stiffness?: number;
  /** A noise layer on the onset — a mallet, a thumb, a fingernail. */
  noise?: { level: number; hz: number; q: number; ring: number };
  body?: BodyResonance[];
  gain?: number;
  /** Injected, so the same bell is the same bell twice. */
  random?: RandomSource;
}

/**
 * A tube with a jet of air across its mouth.
 *
 * A wind instrument is not a filter that noise is poured through. The
 * jet curls into the tube and is deflected by what it finds there, so the
 * air's own motion steers the airstream that is driving it — which is why
 * a flute holds a pitch instead of hissing, and why it starts to sound on
 * its own once the player's embouchure is right. The nonlinearity below
 * is that feedback, and it is also what keeps the note from running away.
 */
export interface WindSpec {
  frequency: number;
  sampleRate: number;
  seconds: number;
  /** How long the note takes to speak. A wind instrument is slow. */
  attack: number;
  /**
   * A stopped pipe — closed at one end, like a clarinet — reflects with
   * its phase flipped, so it can only hold odd harmonics and overblows a
   * twelfth rather than an octave. A flute, open at both ends, holds
   * every harmonic. It is the difference you hear between the two.
   */
  stopped?: boolean;
  /**
   * The airstream: how hard it blows, how turbulent it is, and how much of
   * it is a smooth stream rather than turbulence. A flute is almost all
   * stream and a reed is not, which is most of why they sound different.
   */
  jet: { pressure: number; noise: number; tone?: number; damping?: number };
  /** The hiss of air that never enters the tube, 0..1. */
  breath: number;
  /** The tube's own resonances, which do not transpose. */
  body?: BodyResonance[];
  gain?: number;
}

/**
 * A membrane or a plate hit by a stick: modes that fall in pitch as they
 * die, and bands of noise for the stick and the wires.
 */
export interface DrumSpec {
  sampleRate: number;
  seconds: number;
  /**
   * The frequency this model is written at. Everything below is in
   * absolute Hz against it, and the drum playing it is scaled by how far
   * its own pitch is from this — so a bigger snare is this snare, bigger,
   * rather than a second set of numbers that drifts away from the first.
   */
  tone: number;
  /** Pitched part: frequency, an optional further ratio, ring, level. */
  modes: Array<{ hz: number; ratio?: number; ring: number; level?: number }>;
  /** Frequency multiplier the pitched part reaches at the end of its life. */
  glide?: number;
  /**
   * The noise parts. A snare needs two — the band the head makes and the
   * band the wires make — and one band cannot be both.
   */
  noises?: Array<{ hz: number; q: number; ring: number; level: number; highpass?: boolean }>;
  gain?: number;
}

const SILENT = 1e-4;

/**
 * Allpass sections in the string's loop. Inharmonicity is bought with
 * them, and this is how much is bought.
 */
const STIFFNESS_SECTIONS = 4;

/**
 * A wind's loop is damped hard — that is what makes it hold one pitch —
 * so its output is far quieter than a plucked string's for the same
 * nominal gain. This brings it back up.
 */
const WIND_DRIVE = 5.5;

/** What a `breath` of 1 is worth against the note itself. */
const WIND_BREATH = 0.35;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A -60dB decay over `seconds`, expressed as a per-second multiplier. */
function decayRate(seconds: number): number {
  return Math.log(1000) / Math.max(seconds, 1e-4);
}

/**
 * The delay of the loop filter at `omega`, in samples.
 *
 * A loop resonates where its total delay is one period, and the filter is
 * part of that delay. Leaving it out is the classic Karplus-Strong tuning
 * error: the string plays sharp, by more the heavier the damping. Both
 * filters below are first order, so their phase at the fundamental is a
 * closed form rather than something to fit.
 */
function loopDelay(omega: number, damping: number, stiffness: number): number {
  // One-pole lowpass: (1 - a) / (1 - a e^-jw).
  const a = clamp(damping, 0, 0.95);
  const lpPhase = -Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega));

  // `stiffness` first-order allpass sections, (-c + z^-1) / (1 - c z^-1).
  //
  // One section is nearly transparent to dispersion: at c = 0.4 a pair of
  // them delays the sixth partial two hundredths of a sample less than the
  // fundamental, over a round trip of two hundred. Four sections with a
  // larger coefficient is what it takes for the stretch to be a stretch
  // rather than a rounding error.
  const c = clamp(stiffness, 0, 0.9) * 0.82;
  let apPhase = 0;
  if (c > 0) {
    for (let section = 0; section < STIFFNESS_SECTIONS; section += 1) {
      const numPhase = Math.atan2(-Math.sin(omega), -c + Math.cos(omega));
      const denPhase = Math.atan2(c * Math.sin(omega), 1 - c * Math.cos(omega));
      apPhase += numPhase - denPhase;
    }
  }

  const total = lpPhase + apPhase;
  return -total / Math.max(omega, 1e-6);
}

/** Read `delay` samples back from a circular buffer, between two samples. */
function readDelay(buffer: Float32Array, write: number, delay: number): number {
  const size = buffer.length;
  const whole = Math.floor(delay);
  const frac = delay - whole;
  const first = (write - whole + size * 2) % size;
  const second = (first - 1 + size) % size;
  return buffer[first] * (1 - frac) + buffer[second] * frac;
}

/** RBJ peaking filter, applied in place. */
function applyPeak(
  samples: Float32Array,
  sampleRate: number,
  hz: number,
  q: number,
  db: number
): void {
  const nyquist = sampleRate / 2;
  const f0 = clamp(hz, 20, nyquist * 0.98);
  const amplitude = Math.pow(10, db / 40);
  const omega = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.max(q, 0.1));
  const cos = Math.cos(omega);

  const b0 = 1 + alpha * amplitude;
  const b1 = -2 * cos;
  const b2 = 1 - alpha * amplitude;
  const a0 = 1 + alpha / amplitude;
  const a1 = -2 * cos;
  const a2 = 1 - alpha / amplitude;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const x0 = samples[index];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    samples[index] = y0;
  }
}

function applyBody(samples: Float32Array, sampleRate: number, body?: BodyResonance[]): void {
  if (!body?.length) return;
  for (const resonance of body) {
    applyPeak(samples, sampleRate, resonance.hz, resonance.q, resonance.db);
  }
}

/**
 * Bring a rendered note to its level.
 *
 * A pluck is one gesture with one peak, so scaling that peak to `gain` is
 * the level. A driven string is not: the harder it is driven the peakier
 * its waveform gets, so peak-normalising it makes a hard bow *quieter*
 * than a light one — the loudness is in the ratio, and the ratio is the
 * first thing a peak scale throws away. A driven model is already bounded
 * by its own saturation, so its gain is applied as it stands.
 */
function finish(samples: Float32Array, gain: number, driven = false): Float32Array {
  if (driven) {
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = clamp(samples[index] * gain, -1, 1);
    }
    return samples;
  }
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.abs(samples[index]);
    if (value > peak) peak = value;
  }
  const scale = peak > 0 ? gain / peak : 0;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= scale;
  }
  return samples;
}

/**
 * A plucked or struck string.
 *
 * The excitation is a burst of noise shaped by where it was plucked — a
 * string excited at its middle cannot sound the partials that have a node
 * there, which is why a guitar's bridge pickup and its neck pickup are
 * different instruments.
 */
export function renderString(spec: StringSpec, random: RandomSource): Float32Array {
  const { frequency, sampleRate } = spec;
  const total = Math.max(1, Math.round(spec.seconds * sampleRate));
  const out = new Float32Array(total);

  // One trip round the loop is one period, so the loop's gain per trip is
  // what sets how long the note rings. A bowed string is not left to ring
  // at all: it is driven, so the loop only has to be stable.
  const damping = clamp(spec.damping, 0, 0.95);
  const stiffness = clamp(spec.stiffness ?? 0, 0, 0.9);
  const periods = Math.max(spec.ring, 0.01) * frequency;
  const loopGain = spec.bow ? 0.999 : Math.pow(10, -3 / periods);

  const omega = (2 * Math.PI * frequency) / sampleRate;
  const length = Math.max(2.5, sampleRate / frequency - loopDelay(omega, damping, stiffness));
  const size = Math.ceil(length) + 2;
  const line = new Float32Array(size);

  // Excitation: a burst of noise, dulled by `brightness` and combed by
  // where it was plucked.
  const brightness = clamp(spec.brightness ?? 0.6, 0, 1);
  const burstLength = Math.max(2, Math.ceil(length));
  const burst = new Float32Array(burstLength);
  /*
   * A one-pole lowpass across the burst, and the coefficient is the
   * *smoothing* — so it runs opposite to the brightness. Getting that
   * backwards makes every instrument do the opposite of what its data
   * says, which is silent until something measures the spectrum.
   *
   * The range is bounded at both ends and neither end is the extreme of
   * the filter. A coefficient near zero is no filter at all, which is not
   * a bright pluck but a burst of white noise — the note underneath it is
   * still there and the ear hears only the click. A coefficient near one
   * is a thump with no string in it. Between them: about 550Hz for a
   * thumb and about 6kHz for a pick, which is where real ones live.
   */
  const smoothing = 0.93 - brightness * 0.48;
  let dull = 0;
  for (let index = 0; index < burstLength; index += 1) {
    const noise = random() * 2 - 1;
    dull = dull * smoothing + noise * (1 - smoothing);
    burst[index] = dull;
  }

  const pluck = clamp(spec.pluckPosition ?? 0.25, 0.02, 0.98);
  const notch = Math.max(1, Math.round(pluck * length));
  if (spec.bow) {
    // Nothing has been plucked, so the string starts still and the bow is
    // what moves it.
    line.fill(0);
  } else {
    for (let index = 0; index < size; index += 1) {
      line[index] = burst[index % burstLength] - burst[(index - notch + burstLength * 2) % burstLength];
    }
  }

  // The loop itself. `dull` is the filter state and the allpass history is
  // the two `ap` pairs.
  const attack = Math.max(0, spec.attack ?? 0);
  const attackSamples = Math.max(1, Math.round(attack * sampleRate));
  const c = stiffness * 0.82;
  const apX = new Float32Array(STIFFNESS_SECTIONS);
  const apY = new Float32Array(STIFFNESS_SECTIONS);
  let dullState = 0;
  let write = 0;

  // A bow's own noise, low-passed by how much hair is in contact with the
  // string. Rosin on hair is not white noise; it is the top end of a
  // scrape, and leaving it white makes the bow sound like tape hiss.
  const bow = spec.bow;
  const bowTone = clamp(spec.brightness ?? 0.6, 0, 1) * 0.85;
  let bowState = 0;

  for (let index = 0; index < total; index += 1) {
    let value = readDelay(line, write, length);

    // Dispersion: the allpass chain delays the low partials more than the
    // high ones, so the partials land progressively sharp of whole
    // multiples — which is what a stiff string does and a flexible one
    // does not.
    if (c > 0) {
      for (let section = 0; section < STIFFNESS_SECTIONS; section += 1) {
        const next = -c * value + apX[section] + c * apY[section];
        apX[section] = value;
        apY[section] = next;
        value = next;
      }
    }

    dullState = value * (1 - damping) + dullState * damping;
    let fed = dullState * loopGain;

    if (bow) {
      const scrape = random() * 2 - 1;
      bowState = bowState * bowTone + scrape * (1 - bowTone);
      fed += bowState * bow.noise * bow.pressure;
      // Rosin does not grip harder forever. Friction saturates, and that
      // saturation is what sets the string's level — not the loop's loss.
      // Without it a driven loop either runs away or has to be damped so
      // hard it stops being a string.
      fed = fed / (1 + Math.abs(fed));
    }

    line[write] = fed;
    write = (write + 1) % size;

    // A hammer takes a moment to arrive; a pick does not. Scoring the
    // onset in rather than switching it on is most of the difference
    // between a piano and a harpsichord. A bow is slower still — it has to
    // catch the string before it can drive it.
    out[index] = index < attackSamples ? value * (index / attackSamples) : value;
  }

  applyBody(out, sampleRate, spec.body);
  // A bow's own gain is set at the string and shaped by the body; scaling
  // it to its own peak would undo the pressure that produced it.
  const scale = (spec.gain ?? 0.8) * (spec.bow ? 2.2 : 1);
  return finish(out, scale, spec.bow !== undefined);
}

/**
 * A struck bar, tine or bell: modes that all start together and end
 * separately. No delay line, because there is no string — which is the
 * point of having both.
 */
export function renderModal(spec: ModalSpec): Float32Array {
  const { sampleRate } = spec;
  const total = Math.max(1, Math.round(spec.seconds * sampleRate));
  const out = new Float32Array(total);
  const stiffness = clamp(spec.stiffness ?? 0, 0, 0.5);

  spec.ratios.forEach((ratio, index) => {
    const ring = spec.ring[Math.min(index, spec.ring.length - 1)];
    const level = spec.levels?.[Math.min(index, (spec.levels?.length ?? 1) - 1)] ?? 1;
    // Stiffness stretches the partials sharp, and it stretches the high
    // ones more — the same square law a real bar follows.
    const stretched = ratio * Math.sqrt(1 + stiffness * ratio * ratio);
    const hz = spec.frequency * stretched;
    if (hz >= sampleRate / 2 || level <= 0) return;

    const omega = (2 * Math.PI * hz) / sampleRate;
    const rate = decayRate(ring);
    // y[n] = 2cos(w)y[n-1] - y[n-2] is sin(wn) exactly, without a sine
    // call per sample: a twelve-mode bell over three seconds is otherwise
    // a million transcendental calls on the first note played.
    // y[n] = 2cos(w)y[n-1] - y[n-2] with y[-1] = -sin(w), y[0] = 0 gives
    // y[n] = sin(wn) exactly.
    const twoCos = 2 * Math.cos(omega);
    let previous = -Math.sin(omega);
    let current = 0;
    for (let index = 0; index < total; index += 1) {
      const envelope = Math.exp(-rate * (index / sampleRate));
      out[index] += current * envelope * level;
      const next = twoCos * current - previous;
      previous = current;
      current = next;
    }
  });

  if (spec.noise && spec.noise.level > 0) {
    addNoiseBand(out, sampleRate, spec.noise, spec.random);
  }

  applyBody(out, sampleRate, spec.body);
  return finish(out, spec.gain ?? 0.8);
}

/** A band of noise with its own life, added to whatever is already there. */
function addNoiseBand(
  out: Float32Array,
  sampleRate: number,
  noise: {
    level: number;
    hz: number;
    q: number;
    ring: number;
    highpass?: boolean;
    /**
     * Held rather than struck. Breath is not a transient: it is there for
     * as long as the note is, and giving it a decay makes the hiss die
     * away under a note that is still sounding.
     */
    steady?: boolean;
  },
  random?: RandomSource
): void {
  const next = random ?? Math.random;
  const omega = (2 * Math.PI * clamp(noise.hz, 20, sampleRate * 0.49)) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.max(noise.q, 0.1));
  const cos = Math.cos(omega);
  // RBJ, constant peak gain — a band you can set the level of.
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const b0 = noise.highpass ? (1 + cos) / 2 : alpha;
  const b1 = noise.highpass ? -(1 + cos) : 0;
  const b2 = noise.highpass ? (1 + cos) / 2 : -alpha;
  const step = Math.exp(-decayRate(noise.ring) / sampleRate);

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let envelope = 1;
  for (let index = 0; index < out.length; index += 1) {
    if (!noise.steady && envelope < SILENT) break;
    const x0 = next() * 2 - 1;
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[index] += y0 * (noise.steady ? 1 : envelope) * noise.level;
    envelope *= step;
  }
}

/**
 * A drum: a tuned part that falls in pitch as the head stops moving, and
 * a band of noise for the stick and the wires. Hold the pitch and it stops
 * being a drum; take the noise away and a snare becomes a bleep.
 */
export function renderDrum(spec: DrumSpec, random: RandomSource): Float32Array {
  const { sampleRate } = spec;
  const total = Math.max(1, Math.round(spec.seconds * sampleRate));
  const out = new Float32Array(total);
  const glide = spec.glide ?? 1;

  for (const mode of spec.modes) {
    const hz = mode.hz * (mode.ratio ?? 1);
    if (hz >= sampleRate / 2) continue;
    const level = mode.level ?? 1;

    // The pitch drop is the sound: a membrane stiffens as it is deflected,
    // so the partial arrives sharp and settles. Both the envelope and the
    // pitch step rather than being recomputed per sample.
    const envelopeStep = Math.exp(-decayRate(mode.ring) / sampleRate);
    const sweep = Math.log(Math.max(glide, 1e-3)) / Math.max(total, 1);
    const sweepStep = Math.exp(sweep);
    let envelope = 1;
    let omega = (2 * Math.PI * hz) / sampleRate;
    let phase = 0;
    for (let index = 0; index < total; index += 1) {
      if (envelope < SILENT) break;
      phase += omega;
      out[index] += Math.sin(phase) * envelope * level;
      envelope *= envelopeStep;
      omega *= sweepStep;
    }
  }

  for (const band of spec.noises ?? []) {
    addNoiseBand(out, sampleRate, band, random);
  }

  return finish(out, spec.gain ?? 0.9);
}


/**
 * A blown tube.
 *
 * The loop is the air column and the excitation is a jet, and three things
 * in here are the instrument rather than decoration:
 *
 *  - **The mouth saturates.** That is what bounds the note, and it is why
 *    blowing harder makes a louder note instead of a runaway one. It is
 *    the same mechanism as the bow's, which is not a coincidence: both are
 *    a player feeding energy into a resonator that answers back.
 *  - **The tube's losses grow with frequency.** Radiation and viscothermal
 *    drag take the top off every trip, and that is what picks the
 *    fundamental out of all the modes a delay line can hold. Without it
 *    the tube squeals on whichever high mode wins.
 *  - **The jet is a stream, not a hiss.** Air arriving at a mouth is a
 *    moving column that the tube locks to; white noise at the same level
 *    is just noise, and measuring the result reads as noise too.
 *
 * An open tube also radiates no static pressure, so the loop cannot hold
 * one: a plucked string may sit at an offset, a flute may not.
 */
export function renderWind(spec: WindSpec, random: RandomSource): Float32Array {
  const { frequency, sampleRate } = spec;
  const total = Math.max(1, Math.round(spec.seconds * sampleRate));
  const out = new Float32Array(total);

  // A stopped pipe holds half a wavelength, so one trip round the loop is
  // half a period — and it reflects inverted, which is what removes the
  // even harmonics and makes it overblow a twelfth rather than an octave.
  const open = !spec.stopped;
  const pressure = clamp(spec.jet.pressure, 0, 1);
  const jetNoise = clamp(spec.jet.noise, 0, 1);
  // How much of the jet is a smooth stream rather than turbulence. It is
  // the difference between a flute and a reed: one is almost all stream.
  const tone = clamp(spec.jet.tone ?? 0.6, 0, 1);
  const damp = clamp(spec.jet.damping ?? 0.4, 0, 0.95);

  // The tube's own lowpass is part of the round trip, so its phase delay
  // is part of the period. Leaving it out is the same mistake as leaving
  // the string's damping filter out: the instrument plays flat, by more
  // the heavier its losses. Taken at the note rather than at DC, because
  // the delay a one-pole adds is not the same at every frequency and the
  // top of the range is where the difference starts to be audible.
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const filterPhase =
    Math.atan2(damp * Math.sin(omega), 1 - damp * Math.cos(omega)) / Math.max(omega, 1e-6);
  const length = Math.max(
    2.5,
    sampleRate / (open ? frequency : frequency * 2) - filterPhase
  );
  const size = Math.ceil(length) + 2;
  const line = new Float32Array(size);
  const reflection = open ? 1 : -1;
  const attackSamples = Math.max(1, Math.round(spec.attack * sampleRate));

  let write = 0;
  let offset = 0;
  let lp = 0;
  let jetState = 0;

  for (let index = 0; index < total; index += 1) {
    const value = readDelay(line, write, length);

    const scrape = random() * 2 - 1;
    jetState = jetState * tone + scrape * (1 - tone);

    lp = lp * damp + value * (1 - damp);
    let fed = lp * reflection * 0.999 + jetState * pressure * jetNoise * 0.35;
    fed = fed / (1 + Math.abs(fed));
    line[write] = fed;
    write = (write + 1) % size;

    // The DC blocker is outside the loop's own arithmetic because it is
    // about what the tube can radiate, not about the arithmetic.
    offset += (value - offset) * 0.0008;
    const sounded = value - offset;

    out[index] = index < attackSamples ? sounded * (index / attackSamples) : sounded;
  }

  // Air that never entered the tube: not part of the loop, and the reason
  // a flute is a flute rather than a sine with an envelope.
  if (spec.breath > 0) {
    addNoiseBand(
      out,
      sampleRate,
      {
        // Well above the note's lower harmonics, where breath actually
        // sits — a band down at the fundamental is not air over a note,
        // it is a pillow over one.
        // A fraction of the note, not of the buffer: breath at the same
        // level as the tone is not a breathy flute, it is a flute-shaped
        // hiss, and it is noisy enough that a pitch detector cannot find
        // the note in it — which is what "too much" means here.
        level: spec.breath * WIND_BREATH,
        // Air noise is broadband and sits well above the note; where
        // exactly matters less than that it never stops while the note is
        // sounding.
        hz: clamp(frequency * 5, 1400, 9000),
        q: 0.4,
        ring: spec.seconds,
        highpass: true,
        steady: true
      },
      random
    );
  }

  applyBody(out, sampleRate, spec.body);
  // Like the bow: a driven model keeps its own level, because the harder
  // it is blown the louder it must be. The constant is what it takes to
  // bring a heavily damped loop up to the level the plucked models reach.
  return finish(out, (spec.gain ?? 0.8) * WIND_DRIVE, true);
}
