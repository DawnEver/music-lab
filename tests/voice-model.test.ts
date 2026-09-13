import { describe, expect, it } from "vitest";
import {
  renderDrum,
  renderModal,
  renderString,
  type BodyResonance
} from "../src/lib/voice-model.js";
import { detectPitchYin } from "../src/lib/pitch-detection.js";

const SAMPLE_RATE = 48000;

/** A random source with a fixed seed, so every test renders the same note. */
function seeded(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * The pitch of a rendered note, in cents away from what was asked for.
 *
 * The model is a delay line, so a length that is off by a fraction of a
 * sample is a note that is off by a measurable interval. This is the one
 * number that says whether the loop filter's own delay was accounted for.
 */
function pitchOf(samples: Float32Array, range?: { minHz: number; maxHz: number }): number {
  const result = detectPitchYin(samples, SAMPLE_RATE, -120, range);
  return result.pitch?.frequency ?? NaN;
}

function centsOff(samples: Float32Array, hz: number): number {
  const start = Math.floor(samples.length * 0.1);
  const measured = pitchOf(samples.subarray(start, start + 4096));
  if (!Number.isFinite(measured)) return NaN;
  return 1200 * Math.log2(measured / hz);
}

const at = (seconds: number) => Math.floor(seconds * SAMPLE_RATE);

/** RMS between two points in the note's life, in seconds. */
function rms(samples: Float32Array, from: number, to: number): number {
  const start = Math.min(at(from), samples.length);
  const end = Math.min(at(to), samples.length);
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** How many dB the note has fallen between two points in its life. */
function fallDb(samples: Float32Array, from: number, to: number): number {
  const early = Math.max(rms(samples, from, from + 0.05), 1e-12);
  const late = Math.max(rms(samples, to, to + 0.05), 1e-12);
  return 20 * Math.log10(early / late);
}

/** Magnitude of the spectrum at one frequency, by a direct DFT bin. */
function magnitudeAt(samples: Float32Array, hz: number, from = 0.1, to = 0.4): number {
  const start = Math.min(at(from), samples.length);
  const end = Math.min(at(to), samples.length);
  let real = 0;
  let imaginary = 0;
  for (let index = start; index < end; index += 1) {
    const angle = (2 * Math.PI * hz * index) / SAMPLE_RATE;
    real += samples[index] * Math.cos(angle);
    imaginary += samples[index] * Math.sin(angle);
  }
  return Math.hypot(real, imaginary) / Math.max(1, end - start);
}

/** The frequency a window is vibrating at, from how often it crosses zero. */
function zeroCrossHz(samples: Float32Array, from: number, to: number): number {
  const start = Math.min(at(from), samples.length);
  const end = Math.min(at(to), samples.length);
  let crossings = 0;
  for (let index = start + 1; index < end; index += 1) {
    if (samples[index - 1] < 0 && samples[index] >= 0) crossings += 1;
  }
  return (crossings * SAMPLE_RATE) / Math.max(1, end - start);
}

/** The strongest frequency in a window, by a coarse DFT sweep. */
function peakHz(samples: Float32Array, low: number, high: number, from: number, to: number): number {
  let best = 0;
  let bestHz = 0;
  for (let hz = low; hz <= high; hz += 0.25) {
    const value = magnitudeAt(samples, hz, from, to);
    if (value > best) {
      best = value;
      bestHz = hz;
    }
  }
  return bestHz;
}

describe("renderString", () => {
  const note = (overrides: Partial<Parameters<typeof renderString>[0]> = {}) => {
    const spec = {
      frequency: 220,
      sampleRate: SAMPLE_RATE,
      seconds: 3,
      ring: 2,
      damping: 0.4,
      ...overrides
    };
    return { spec, samples: renderString(spec, seeded(7)) };
  };

  it("plays the note it was asked for", () => {
    for (const frequency of [82.41, 220, 440, 880]) {
      const { samples } = note({ frequency });
      expect(Math.abs(centsOff(samples, frequency))).toBeLessThan(8);
    }
  });

  /*
   * The single property an oscillator cannot have: the loop filter costs
   * the high partials more than the low ones on every trip, so they die
   * first. This is what the ear hears as "something is resonating".
   */
  it("loses its top end long before its fundamental", () => {
    const { samples } = note({ ring: 4, damping: 0.45 });
    const survives = (hz: number) =>
      magnitudeAt(samples, hz, 1.5, 2) / Math.max(magnitudeAt(samples, hz, 0, 0.2), 1e-12);
    // A `ring` of 4 seconds over a 2-second window is -30dB, so a
    // thirtieth of it is exactly what the fundamental should have left.
    expect(survives(220)).toBeGreaterThan(0.02);
    expect(survives(220)).toBeGreaterThan(survives(220 * 5) * 10);
    expect(survives(220 * 9)).toBeLessThan(survives(220 * 5));
  });

  it("keeps more of its top end when it is damped lightly", () => {
    const bright = note({ damping: 0.08, ring: 4 }).samples;
    const dull = note({ damping: 0.7, ring: 4 }).samples;
    const ratio = (samples: Float32Array) =>
      magnitudeAt(samples, 220 * 9, 1.5, 2) / Math.max(magnitudeAt(samples, 220 * 9, 0, 0.2), 1e-12);
    expect(ratio(bright)).toBeGreaterThan(ratio(dull));
  });

  it("rings for as long as it was asked to", () => {
    const { samples } = note({ ring: 2 });
    // -60dB is a fall of 60; allow the filter's own gain on top of it.
    expect(fallDb(samples, 0.02, 2)).toBeGreaterThan(45);
    expect(fallDb(samples, 0.02, 2)).toBeLessThan(80);
  });

  it("dies sooner when it is damped harder", () => {
    const light = note({ damping: 0.1, ring: 2 }).samples;
    const heavy = note({ damping: 0.75, ring: 2 }).samples;
    expect(fallDb(heavy, 0.02, 1)).toBeGreaterThan(fallDb(light, 0.02, 1));
  });

  /*
   * A string excited at its middle has a node there, and no partial with
   * a node at that point can sound. Halfway along kills every even one.
   */
  it("kills the partials that have a node where it was plucked", () => {
    const middle = note({ pluckPosition: 0.5, ring: 4 }).samples;
    const fundamental = magnitudeAt(middle, 220);
    expect(magnitudeAt(middle, 440) / fundamental).toBeLessThan(0.1);
  });

  it("keeps the even partials when it is plucked off-centre", () => {
    const quarter = note({ pluckPosition: 0.25, ring: 4 }).samples;
    const fundamental = magnitudeAt(quarter, 220);
    expect(magnitudeAt(quarter, 440) / fundamental).toBeGreaterThan(0.2);
  });

  /*
   * A real string is stiff, so its partials sit progressively sharp of
   * whole multiples. A perfectly flexible string is the one thing no
   * instrument has ever been, and its absence is audible as "too clean".
   */
  it("stretches the partials sharp when the string is stiff", () => {
    const flexible = note({ stiffness: 0, ring: 4 }).samples;
    const stiff = note({ stiffness: 0.8, ring: 4 }).samples;
    // The sixth partial of 220Hz is 1320; a stiff string puts it higher.
    expect(peakHz(stiff, 1320, 1400, 0, 0.5)).toBeGreaterThan(
      peakHz(flexible, 1320, 1400, 0, 0.5) + 1
    );
  });

  /*
   * A body resonance does not transpose. This is the difference between
   * a guitar and the same string with a different filter on it: play a
   * fifth higher and the guitar's own peak stays exactly where it was.
   */
  it("keeps its body resonances where they are, whatever the note", () => {
    const body: BodyResonance[] = [{ hz: 500, q: 8, db: 18 }];
    // Two notes that share no partial: 250's second is on the resonance,
    // 200's fifth is — if the resonance moved with the note, they could
    // not both be lifted at the same frequency.
    const lifted = (frequency: number) => {
      const bare = renderString({ ...note().spec, frequency, ring: 4 }, seeded(7));
      const withBody = renderString({ ...note().spec, frequency, body, ring: 4 }, seeded(7));
      return magnitudeAt(withBody, 500, 0, 0.5) / Math.max(magnitudeAt(bare, 500, 0, 0.5), 1e-12);
    };
    expect(lifted(250)).toBeGreaterThan(2);
    expect(lifted(200)).toBeGreaterThan(1.5);
  });

  it("is the same note twice from the same random source", () => {
    const first = renderString({ ...note().spec }, seeded(11));
    const second = renderString({ ...note().spec }, seeded(11));
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  /*
   * A bowed string is not a pluck that lasts longer. The bow keeps feeding
   * it, so the level settles instead of decaying — which is the whole
   * difference between a violin and a guitar with a long sustain.
   */
  describe("bowing", () => {
    const bowed = (overrides = {}) =>
      note({
        ring: 1,
        damping: 0.35,
        stiffness: 0.2,
        body: [{ hz: 300, q: 2, db: 8 }, { hz: 700, q: 1.5, db: 5 }],
        bow: { pressure: 0.5, noise: 0.35 },
        attack: 0.06,
        seconds: 3,
        ...overrides
      }).samples;

    it("holds its level instead of decaying", () => {
      const samples = bowed();
      // A plucked string of the same `ring` would be 60dB down by now.
      expect(fallDb(samples, 0.6, 2.4)).toBeLessThan(6);
    });

    it("still takes its time to speak", () => {
      const samples = bowed();
      const early = rms(samples, 0, 0.02);
      const settled = rms(samples, 0.4, 0.6);
      expect(settled).toBeGreaterThan(early * 4);
    });

    it("gets louder the harder the bow presses", () => {
      const light = bowed({ bow: { pressure: 0.12, noise: 1 } });
      const hard = bowed({ bow: { pressure: 0.9, noise: 1 } });
      expect(rms(hard, 1, 2)).toBeGreaterThan(rms(light, 1, 2) * 2);
    });

    it("stays inside the buffer, which a driven loop need not", () => {
      const samples = bowed({ bow: { pressure: 1, noise: 1 }, ring: 30 });
      let peak = 0;
      for (const value of samples) peak = Math.max(peak, Math.abs(value));
      expect(peak).toBeLessThanOrEqual(1.0001);
      expect(Number.isFinite(peak)).toBe(true);
    });

    it("plays the pitch it was asked for while it is being driven", () => {
      const samples = bowed();
      expect(Math.abs(centsOff(samples, 220))).toBeLessThan(8);
    });
  });

  it("never leaves the buffer", () => {
    for (const gain of [0.2, 1]) {
      const { samples } = note({ gain });
      let peak = 0;
      for (const value of samples) peak = Math.max(peak, Math.abs(value));
      expect(peak).toBeLessThanOrEqual(1.0001);
      expect(peak).toBeGreaterThan(0.05);
    }
  });
});

describe("renderModal", () => {
  it("puts its partials where the ratios say", () => {
    const samples = renderModal({
      frequency: 440,
      sampleRate: SAMPLE_RATE,
      seconds: 2,
      ratios: [1, 2.76, 5.4],
      ring: [2, 1, 0.5],
      gain: 0.5
    });
    const at = (hz: number) => magnitudeAt(samples, hz);
    expect(at(440)).toBeGreaterThan(at(600));
    expect(at(440 * 2.76)).toBeGreaterThan(at(440 * 3.5));
    expect(at(440 * 5.4)).toBeGreaterThan(at(440 * 4));
  });

  it("lets the high modes die first", () => {
    const samples = renderModal({
      frequency: 440,
      sampleRate: SAMPLE_RATE,
      seconds: 2,
      ratios: [1, 4],
      ring: [2, 0.2],
      gain: 0.5
    });
    const early = magnitudeAt(samples, 440 * 4, 0, 0.05) / magnitudeAt(samples, 440, 0, 0.05);
    const late = magnitudeAt(samples, 440 * 4, 0.75, 0.9) / magnitudeAt(samples, 440, 0.75, 0.9);
    expect(late).toBeLessThan(early);
  });
});

describe("renderDrum", () => {
  const kick = (overrides = {}) =>
    renderDrum(
      {
        sampleRate: SAMPLE_RATE,
        seconds: 1,
        tone: 55,
        modes: [{ hz: 55, ring: 0.5, level: 1 }],
        glide: 0.3,
        gain: 0.9,
        ...overrides
      },
      seeded(3)
    );

  /*
   * A membrane stiffens as it is deflected, so its partial arrives sharp
   * and settles. Hold the pitch and it stops being a drum and becomes a
   * low beep — which is exactly what a plain sine gives.
   */
  it("falls in pitch as it dies", () => {
    const samples = kick();
    // A drum's pitch is falling the whole time, so it is measured as a
    // rate rather than as a spectrum: a window shorter than one period of
    // the lowest note cannot resolve it, and a long one smears the fall.
    const early = zeroCrossHz(samples, 0.005, 0.045);
    const late = zeroCrossHz(samples, 0.2, 0.3);
    expect(early).toBeGreaterThan(late * 1.2);
  });

  it("carries a noise layer when it is asked for one", () => {
    const without = kick();
    const with_ = kick({ noises: [{ hz: 1900, q: 0.7, ring: 0.2, level: 0.9 }] });
    // Band-limited noise across the drumhead is most of a snare; the
    // pitched part alone reads as a bleep.
    expect(magnitudeAt(with_, 1900, 0, 0.1)).toBeGreaterThan(
      magnitudeAt(without, 1900, 0, 0.1) * 3
    );
  });

  it("is the same hit twice from the same random source", () => {
    const spec = {
      sampleRate: SAMPLE_RATE,
      seconds: 0.5,
      tone: 1900,
      modes: [{ hz: 190, ring: 0.2 }],
      noises: [{ hz: 1900, q: 0.7, ring: 0.2, level: 0.8 }]
    };
    expect(Array.from(renderDrum(spec, seeded(5)))).toEqual(
      Array.from(renderDrum(spec, seeded(5)))
    );
  });
});
