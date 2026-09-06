import { describe, expect, it } from "vitest";
import { createVoicePlayer, type VoiceSpec } from "../src/audio/voice.js";
import { clickSpec } from "../src/features/metronome/engine/click-engine.js";
import { soundBank } from "../src/features/metronome/engine/sound-bank.js";

interface Ramp {
  value: number;
  time: number;
}

/** A fake AudioContext recording what a voice schedules. */
function fakeContext(now = 10) {
  const oscillators: Array<{
    type: string;
    frequency: { value: number; at: Ramp[]; ramps: Ramp[] };
    started: number;
    stopped: number;
    disconnected: boolean;
  }> = [];
  const gains: Array<{ ramps: Ramp[]; value: number }> = [];
  const sources: Array<{ started: number; stopped: number }> = [];
  const filters: Array<{ type: string; q: number; ramps: Ramp[] }> = [];

  const param = (store: Ramp[], initial = 0) => ({
    value: initial,
    setValueAtTime(value: number, time: number) {
      store.push({ value, time });
    },
    exponentialRampToValueAtTime(value: number, time: number) {
      store.push({ value, time });
    },
    setTargetAtTime(value: number, time: number) {
      store.push({ value, time });
    }
  });

  const node = () => ({ connect() {}, disconnect() {} });

  const context = {
    currentTime: now,
    sampleRate: 48000,
    createGain() {
      const ramps: Ramp[] = [];
      const entry = { ramps, get value() { return gain.gain.value; } };
      const gain = { ...node(), gain: param(ramps) };
      gains.push(entry as never);
      return gain;
    },
    createOscillator() {
      const at: Ramp[] = [];
      const ramps: Ramp[] = [];
      const entry = {
        type: "sine",
        frequency: { value: 0, at, ramps: at },
        started: -1,
        stopped: -1,
        disconnected: false
      };
      oscillators.push(entry);
      return {
        ...node(),
        set type(value: string) {
          entry.type = value;
        },
        get type() {
          return entry.type;
        },
        frequency: param(at),
        start(time: number) {
          entry.started = time;
        },
        stop(time: number) {
          entry.stopped = time;
        },
        onended: null,
        disconnect() {
          entry.disconnected = true;
        }
      };
    },
    createBufferSource() {
      const entry = { started: -1, stopped: -1 };
      sources.push(entry);
      return {
        ...node(),
        buffer: null,
        start(time: number) {
          entry.started = time;
        },
        stop(time: number) {
          entry.stopped = time;
        },
        onended: null
      };
    },
    createBiquadFilter() {
      const ramps: Ramp[] = [];
      const entry = { type: "highpass", q: 1, ramps };
      filters.push(entry);
      return {
        ...node(),
        set type(value: string) {
          entry.type = value;
        },
        get type() {
          return entry.type;
        },
        Q: {
          get value() {
            return entry.q;
          },
          set value(next: number) {
            entry.q = next;
          }
        },
        frequency: { ...param(ramps), set value(next: number) { ramps.push({ value: next, time: -1 }); } }
      };
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data, length };
    }
  };

  return { context: context as unknown as AudioContext, oscillators, gains, sources, filters };
}

const TONE: VoiceSpec = { waveform: "triangle", frequency: 440, gain: 0.5, duration: 0.4 };

describe("voice player", () => {
  it("starts a note at the requested audio time", () => {
    const fake = fakeContext(10);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 12);
    expect(fake.oscillators).toHaveLength(1);
    expect(fake.oscillators[0].started).toBe(12);
    expect(fake.oscillators[0].type).toBe("triangle");
    expect(fake.oscillators[0].frequency.at[0]).toEqual({ value: 440, time: 12 });
  });

  it("never schedules in the past", () => {
    const fake = fakeContext(10);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 3);
    expect(fake.oscillators[0].started).toBe(10);
  });

  it("stops after the envelope, so nothing is left running", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 1);
    expect(fake.oscillators[0].stopped).toBeGreaterThan(1.4);
  });

  it("adds one oscillator per partial, at harmonic frequencies", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(
      { ...TONE, partials: [0.4, 0.2] },
      1
    );
    expect(fake.oscillators).toHaveLength(3);
    expect(fake.oscillators.map((entry) => entry.frequency.at[0].value)).toEqual([440, 880, 1320]);
  });

  it("skips silent partials", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(
      { ...TONE, partials: [0, 0.2] },
      1
    );
    expect(fake.oscillators).toHaveLength(2);
  });

  it("plays noise voices through a buffer source, not an oscillator", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(
      { waveform: "noise", frequency: 7200, gain: 1, duration: 0.03 },
      1
    );
    expect(fake.sources).toHaveLength(1);
    expect(fake.oscillators).toHaveLength(0);
  });

  it("glides when asked, and holds pitch when not", () => {
    const fake = fakeContext(0);
    const player = createVoicePlayer(fake.context, fake.context.createGain());
    player.play({ ...TONE, glide: 0.5 }, 1);
    expect(fake.oscillators[0].frequency.at).toHaveLength(2);
    player.play(TONE, 1);
    expect(fake.oscillators[1].frequency.at).toHaveLength(1);
  });
});

describe("click specs", () => {
  it("keeps the metronome's click character", () => {
    const spec = clickSpec(soundBank("synth"), "strong")!;
    expect(spec.frequency).toBeCloseTo(880 * 1.5, 6);
    expect(spec.glide).toBe(0.82);
  });

  it("detunes the polyrhythm layer below the main one", () => {
    const main = clickSpec(soundBank("synth"), "weak")!;
    const poly = clickSpec(soundBank("synth"), "weak", "poly")!;
    expect(poly.frequency).toBeCloseTo(main.frequency * 0.66, 6);
  });

  it("makes a muted beat silent rather than quiet", () => {
    expect(clickSpec(soundBank("synth"), "mute")).toBeNull();
  });

  it("does not glide noise voices, which have no pitch to glide", () => {
    expect(clickSpec(soundBank("hihat"), "strong")!.glide).toBe(1);
  });
});

describe("envelope shapes", () => {
  /** Gain ramps of the first tone, as [value, time] pairs. */
  const ramps = (fake: ReturnType<typeof fakeContext>) =>
    // 0 is the destination the test made, 1 the player's output bus.
    (fake.gains[2] as unknown as { ramps: Ramp[] }).ramps;

  it("decays straight to silence when a voice has no sustain — a pluck", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 1);
    const shape = ramps(fake);
    expect(shape).toHaveLength(3);
    expect(shape[2].time).toBeCloseTo(1.4, 6);
    expect(shape[2].value).toBeLessThan(shape[1].value);
  });

  it("holds a level and then releases when a voice sustains", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(
      { ...TONE, attack: 0.01, sustain: 0.5, decay: 0.05, release: 0.1 },
      1
    );
    const shape = ramps(fake);
    // silence, peak, decay-to-sustain, hold, release
    expect(shape).toHaveLength(5);
    expect(shape[1].time).toBeCloseTo(1.01, 6);
    expect(shape[2].time).toBeCloseTo(1.06, 6);
    expect(shape[2].value).toBeCloseTo(shape[1].value * 0.5, 6);
    expect(shape[3].time).toBeCloseTo(1.3, 6); // release starts
    expect(shape[3].value).toBeCloseTo(shape[2].value, 6);
    expect(shape[4].time).toBeCloseTo(1.4, 6);
  });

  it("keeps the release inside the note when the note is shorter than it", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(
      { ...TONE, duration: 0.05, attack: 0.01, sustain: 0.5, release: 5 },
      1
    );
    const shape = ramps(fake);
    for (const step of shape) {
      expect(step.time).toBeGreaterThanOrEqual(1);
      expect(step.time).toBeLessThanOrEqual(1.05 + 1e-9);
    }
  });
});

describe("filter and velocity", () => {
  const FILTERED: VoiceSpec = {
    ...TONE,
    filter: { type: "lowpass", frequency: 2000, q: 0.7, envelope: 4 }
  };

  it("sweeps the cutoff down to its resting value over the note", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(FILTERED, 1);
    expect(fake.filters).toHaveLength(1);
    expect(fake.filters[0].type).toBe("lowpass");
    expect(fake.filters[0].q).toBeCloseTo(0.7, 6);
    const [start, end] = fake.filters[0].ramps;
    expect(start.value).toBeCloseTo(8000, 6);
    expect(end.value).toBeCloseTo(2000, 6);
    expect(end.time).toBeCloseTo(1.4, 6);
  });

  it("opens the filter less when the note is played softly", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(FILTERED, 1, 0.5);
    expect(fake.filters[0].ramps[0].value).toBeCloseTo(2000 * 2.5, 6);
  });

  it("scales loudness by velocity, partials included", () => {
    const fake = fakeContext(0);
    const player = createVoicePlayer(fake.context, fake.context.createGain());
    player.play({ ...TONE, partials: [0.5] }, 1, 0.4);
    const peak = (index: number) => (fake.gains[index] as unknown as { ramps: Ramp[] }).ramps[1].value;
    expect(peak(2)).toBeCloseTo(0.5 * 0.4, 6);
    expect(peak(3)).toBeCloseTo(0.5 * 0.4 * 0.5, 6);
  });

  it("plays nothing at all at zero velocity", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 1, 0);
    expect(fake.oscillators).toHaveLength(0);
  });

  it("leaves unfiltered voices without a filter node", () => {
    const fake = fakeContext(0);
    createVoicePlayer(fake.context, fake.context.createGain()).play(TONE, 1);
    expect(fake.filters).toHaveLength(0);
  });
});
