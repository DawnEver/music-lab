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
