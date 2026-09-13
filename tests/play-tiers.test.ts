import { describe, expect, it, vi } from "vitest";
import {
  createPerformer,
  type SampledNote
} from "../src/features/play/engine/performer.js";
import type { VoicePlayer, VoiceSpec } from "../src/audio/voice.js";

/** A player that records what it was asked for, and how. */
function fakePlayer() {
  const notes: Array<{ at: number; velocity: number; options: { rate?: number; seconds?: number } }> = [];
  const player: VoicePlayer = {
    play() {},
    hold(spec: VoiceSpec, at: number, velocity = 1) {
      notes.push({ at, velocity, options: {} });
      void spec;
      return { release() {} };
    },
    playBuffer(_buffer, at, velocity = 1, options = {}) {
      notes.push({ at, velocity, options });
      return { release() {} };
    },
    setVolume() {},
    dispose() {}
  };
  return { player, notes };
}

/** A recording of one note, standing in for a bank that was never fetched. */
function fakeSample(overrides: Partial<SampledNote> = {}): SampledNote {
  return { buffer: { duration: 2 } as AudioBuffer, offset: 2, gain: 1, ...overrides };
}

function performer(
  player: VoicePlayer,
  options: Partial<Parameters<typeof createPerformer>[0]> = {}
) {
  return createPerformer({
    player,
    context: {
      sampleRate: 48000,
      createBuffer: (_c: number, length: number) => ({
        duration: length / 48000,
        getChannelData: () => new Float32Array(length)
      })
    } as unknown as BaseAudioContext,
    now: () => 0,
    timbreId: "piano",
    ...options
  });
}

/*
 * Three ways to sound the same instrument, and the difference between
 * them is who is playing what. Every tier plays something: an instrument
 * with no recording is not a broken tier, it is the model.
 */
describe("voice tiers", () => {
  it("plays the model alone when the tier is synth", () => {
    const fake = fakePlayer();
    const takeSample = vi.fn(() => fakeSample());
    performer(fake.player, { tier: "synth", sample: "x", takeSample }).noteOn(60);
    expect(fake.notes).toHaveLength(1);
    expect(takeSample).not.toHaveBeenCalled();
  });

  it("plays the recording alone when the tier is samples", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "samples", sample: "x", takeSample: () => fakeSample() }).noteOn(60);
    expect(fake.notes).toHaveLength(1);
    // Resampled by the two semitones between the recording and the note.
    expect(fake.notes[0].options.rate).toBeCloseTo(Math.pow(2, 2 / 12), 6);
    expect(fake.notes[0].options.seconds).toBeUndefined();
  });

  /*
   * A bank is whatever level somebody encoded it at; a model is calibrated
   * to a loudness. Played together without matching them, the recorded
   * attack sits fifteen decibels under the note it is attacking, which is
   * the same as not being there — and the two tiers end up sounding like
   * two different instruments at two different volumes.
   */
  it("applies the recording's own calibration", () => {
    const fake = fakePlayer();
    performer(fake.player, {
      tier: "samples",
      sample: "x",
      takeSample: () => fakeSample({ gain: 6 })
    }).noteOn(60, 0.5);
    expect(fake.notes[0].velocity).toBeCloseTo(3, 6);
  });

  it("lays the recording's attack over the model when the tier is hybrid", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "hybrid", sample: "x", takeSample: () => fakeSample() }).noteOn(60);
    // Both: the model's note, and the recording as an attack that gets out
    // of its way.
    expect(fake.notes).toHaveLength(2);
    const withSeconds = fake.notes.find((note) => note.options.seconds !== undefined);
    expect(withSeconds).toBeDefined();
    // Short: the two are only the same instrument while the transient is
    // still going on, and the seam is audible the moment it is not.
    expect(withSeconds!.options.seconds!).toBeLessThan(0.2);
  });

  it("falls back to the model when there is no recording", () => {
    for (const tier of ["hybrid", "samples"] as const) {
      const fake = fakePlayer();
      performer(fake.player, { tier, sample: undefined, takeSample: () => fakeSample() }).noteOn(60);
      expect(fake.notes, tier).toHaveLength(1);
      expect(fake.notes[0].options.rate, tier).toBeUndefined();
    }
  });

  it("falls back to the model when the bank has not arrived", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "samples", sample: "x", takeSample: () => null }).noteOn(60);
    expect(fake.notes).toHaveLength(1);
    expect(fake.notes[0].options.rate).toBeUndefined();
  });

  it("changes tier without disturbing a note already down", () => {
    const fake = fakePlayer();
    const unit = performer(fake.player, { tier: "synth", sample: "x", takeSample: () => fakeSample() });
    unit.noteOn(60);
    unit.setTier("samples");
    expect(fake.notes).toHaveLength(1);
    unit.noteOn(62);
    expect(fake.notes).toHaveLength(2);
  });
});
