import { describe, expect, it } from "vitest";
import { createPerformer } from "../src/features/play/engine/performer.js";
import type { VoiceSpec, VoicePlayer } from "../src/audio/voice.js";

/** A voice player that records what it was asked to hold. */
function fakePlayer() {
  const notes: Array<{
    spec: VoiceSpec;
    at: number;
    velocity: number;
    releasedAt: number | null;
  }> = [];
  const buffers: AudioBuffer[] = [];
  let volume = -1;
  let disposed = false;

  const player: VoicePlayer = {
    play() {},
    hold(spec, at, velocity = 1) {
      const entry = { spec, at, velocity, releasedAt: null as number | null };
      notes.push(entry);
      return {
        release(time = 0) {
          entry.releasedAt = time;
        }
      };
    },
    playBuffer(buffer, at, velocity = 1) {
      const entry = {
        spec: { waveform: "sine", frequency: 0, gain: 1, duration: buffer.duration } as VoiceSpec,
        at,
        velocity,
        releasedAt: null as number | null
      };
      buffers.push(buffer);
      notes.push(entry);
      return {
        release(time = 0) {
          entry.releasedAt = time;
        }
      };
    },
    setVolume(value) {
      volume = value;
    },
    dispose() {
      disposed = true;
    }
  };

  return {
    player,
    notes,
    buffers,
    get volume() {
      return volume;
    },
    get disposed() {
      return disposed;
    }
  };
}

function performer(now = () => 5) {
  const fake = fakePlayer();
  return { fake, unit: createPerformer({ player: fake.player, now }) };
}

describe("performer", () => {
  it("starts a note on the audio clock, at its tuned pitch", () => {
    let clock = 5;
    const { fake, unit } = performer(() => clock);
    unit.noteOn(69);
    expect(fake.notes).toHaveLength(1);
    expect(fake.notes[0].at).toBe(5);
    expect(fake.notes[0].spec.frequency).toBeCloseTo(440, 6);

    clock = 7;
    unit.setTuning(442);
    unit.noteOn(69);
    expect(fake.notes[1].at).toBe(7);
    expect(fake.notes[1].spec.frequency).toBeCloseTo(442, 6);
  });

  it("releases the note the finger came off, at the time it came off", () => {
    let clock = 5;
    const { fake, unit } = performer(() => clock);
    unit.noteOn(60);
    clock = 6.5;
    unit.noteOff(60);
    expect(fake.notes[0].releasedAt).toBe(6.5);
  });

  it("knows what is currently down, in pitch order", () => {
    const { unit } = performer();
    unit.noteOn(64);
    unit.noteOn(60);
    unit.noteOn(67);
    expect(unit.sounding()).toEqual([60, 64, 67]);
    unit.noteOff(64);
    expect(unit.sounding()).toEqual([60, 67]);
  });

  it("retriggers rather than stacking a second voice on the same key", () => {
    const { fake, unit } = performer();
    unit.noteOn(60);
    unit.noteOn(60);
    expect(fake.notes).toHaveLength(2);
    expect(fake.notes[0].releasedAt).not.toBeNull();
    expect(unit.sounding()).toEqual([60]);
  });

  it("ignores a release for a key that is not down", () => {
    const { fake, unit } = performer();
    unit.noteOff(60);
    expect(fake.notes).toHaveLength(0);
    expect(unit.sounding()).toEqual([]);
  });

  it("lets go of everything at once", () => {
    const { fake, unit } = performer();
    unit.noteOn(60);
    unit.noteOn(64);
    unit.allOff();
    expect(unit.sounding()).toEqual([]);
    expect(fake.notes.every((note) => note.releasedAt !== null)).toBe(true);
  });

  it("carries velocity through to the voice", () => {
    const { fake, unit } = performer();
    unit.noteOn(60, 0.3);
    expect(fake.notes[0].velocity).toBe(0.3);
  });

  it("leaves a sounding note on the timbre it started with", () => {
    const { fake, unit } = performer();
    unit.noteOn(60);
    unit.setTimbre("singable");
    unit.noteOn(64);
    expect(fake.notes[0].releasedAt).toBeNull();
  });

  it("hands volume through and cleans up on dispose", () => {
    const { fake, unit } = performer();
    unit.setVolume(0.4);
    expect(fake.volume).toBe(0.4);
    unit.noteOn(60);
    unit.dispose();
    expect(fake.notes[0].releasedAt).not.toBeNull();
    expect(fake.disposed).toBe(true);
  });
});

describe("strikes", () => {
  it("sounds a piece with no note to release", () => {
    const { fake, unit } = performer();
    unit.strike("hihatClosed", "hihat", 8200);
    expect(fake.notes).toHaveLength(1);
    expect(unit.sounding()).toEqual([]);
  });

  it("lets two ungrouped pieces ring together", () => {
    const { fake, unit } = performer();
    unit.strike("hihatClosed", "hihat", 8200);
    unit.strike("crash", "crash", 5200);
    expect(fake.notes.every((note) => note.releasedAt === null)).toBe(true);
  });

  it("chokes the previous piece in the same group", () => {
    let clock = 5;
    const { fake, unit } = performer(() => clock);
    unit.strike("hihatClosed", "hihat", 8200, 0.9, "hihat");
    clock = 5.5;
    unit.strike("hihatClosed", "hihat", 8200, 0.9, "hihat");
    expect(fake.notes[0].releasedAt).toBe(5.5);
    expect(fake.notes[1].releasedAt).toBeNull();
  });

  it("lets go of a choked piece when everything stops", () => {
    const { fake, unit } = performer();
    unit.strike("hihatClosed", "hihat", 8200, 0.9, "hihat");
    unit.allOff();
    expect(fake.notes[0].releasedAt).not.toBeNull();
  });
});

describe("physical models", () => {
  const MODEL_PLAYER = (fake: ReturnType<typeof fakePlayer>, context: BaseAudioContext) =>
    createPerformer({
      player: fake.player,
      context,
      now: () => 0,
      timbreId: "steel"
    });

  /*
   * A modelled voice is rendered, not built. Nothing should reach the
   * oscillator path at all — if it does, the note is a waveform again and
   * the whole point of the model is gone.
   */
  it("plays a rendered buffer for a timbre that has a model", () => {
    const fake = fakePlayer();
    const context = {
      sampleRate: 48000,
      createBuffer(_channels: number, length: number) {
        return {
          duration: length / 48000,
          getChannelData: () => new Float32Array(length)
        };
      }
    } as unknown as BaseAudioContext;
    const unit = MODEL_PLAYER(fake, context);

    unit.noteOn(60);
    expect(fake.buffers).toHaveLength(1);
    expect(fake.notes[0].spec.waveform).toBe("sine");
    // A guitar's E2 is 82Hz; the rendered note must be that long enough to
    // be a note, not a click.
    expect(fake.notes[0].spec.duration).toBeGreaterThan(1);
    unit.noteOff(60);
    expect(fake.notes[0].releasedAt).not.toBeNull();
  });

  it("hands the same pitch back out of the cache", () => {
    const fake = fakePlayer();
    const context = {
      sampleRate: 48000,
      createBuffer(_channels: number, length: number) {
        return {
          duration: length / 48000,
          getChannelData: () => new Float32Array(length)
        };
      }
    } as unknown as BaseAudioContext;
    const unit = MODEL_PLAYER(fake, context);
    unit.noteOn(60);
    unit.noteOff(60);
    unit.noteOn(60);
    expect(fake.notes[0].spec.duration).toBe(fake.notes[1].spec.duration);
    expect(fake.notes[1].spec.duration).toBeGreaterThan(1);
  });
});
