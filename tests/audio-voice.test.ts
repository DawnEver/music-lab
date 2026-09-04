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
      return { ...node(), type: "highpass", frequency: { value: 0 } };
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data, length };
    }
  };

  return { context: context as unknown as AudioContext, oscillators, gains, sources };
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
