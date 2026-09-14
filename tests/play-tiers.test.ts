import { describe, expect, it, vi } from "vitest";
import {
  createPerformer,
  type SampledNote
} from "../src/features/play/engine/performer.js";
import type { BufferOptions, VoicePlayer, VoiceSpec } from "../src/audio/voice.js";

/** A player that records what it was asked for, and how. */
function fakePlayer() {
  const notes: Array<{ at: number; velocity: number; options: BufferOptions }> = [];
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

  /*
   * A recording of a note *above* the one being played has to be played
   * *slower*, and getting that backwards is worth an octave and a half.
   *
   * It stayed hidden for as long as it did because it cannot be seen where
   * a bank has every note: the piano's offset is zero for all eighty-eight
   * of them, so the exponent never mattered. It matters the moment a bank
   * does not have the note — a contrabass has nothing above its range, and
   * its nearest usable recording is fifteen semitones down — and there the
   * sampled tier answered a C5 with a note an octave and a half below it.
   */
  it("plays the recording alone when the tier is samples", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "samples", sample: "x", takeSample: () => fakeSample() }).noteOn(60);
    expect(fake.notes).toHaveLength(1);
    // The recording is two semitones above the note asked for, so it is
    // slowed by two semitones — not sped up by two.
    expect(fake.notes[0].options.rate).toBeCloseTo(Math.pow(2, -2 / 12), 6);
    expect(fake.notes[0].options.seconds).toBeUndefined();
  });

  it("slows a recording that sits above the note, and speeds one below it", () => {
    const above = fakePlayer();
    performer(above.player, {
      tier: "samples", sample: "x", takeSample: () => fakeSample({ offset: 7 })
    }).noteOn(60);
    const below = fakePlayer();
    performer(below.player, {
      tier: "samples", sample: "x", takeSample: () => fakeSample({ offset: -7 })
    }).noteOn(60);
    // A recording seven semitones up comes down at a rate below one, and
    // one seven semitones down comes up at a rate above it.
    expect(above.notes[0]!.options.rate).toBeLessThan(1);
    expect(below.notes[0]!.options.rate).toBeGreaterThan(1);
    expect(above.notes[0]!.options.rate! * below.notes[0]!.options.rate!).toBeCloseTo(1, 6);
  });

  /*
   * A bank is whatever level somebody encoded it at; a model is calibrated
   * to a loudness. Played together without matching them, the recorded
   * attack sits fifteen decibels under the note it is attacking, which is
   * the same as not being there — and the two tiers end up sounding like
   * two different instruments at two different volumes.
   *
   * The calibration travels as a gain of its own and never as part of the
   * velocity. Velocity is a fraction of a note — how hard the key was
   * struck — and a player's is clamped to 1 by definition; a recording
   * that needs lifting by six has to be lifted by six, and folding the
   * two together is how a sixteen-decibel correction became no correction
   * at all.
   */
  it("applies the recording's own calibration, as a gain", () => {
    const fake = fakePlayer();
    performer(fake.player, {
      tier: "samples",
      sample: "x",
      takeSample: () => fakeSample({ gain: 6 })
    }).noteOn(60, 0.5);
    expect(fake.notes[0].velocity).toBeCloseTo(0.5, 6);
    expect(fake.notes[0].options.gain).toBeCloseTo(6, 6);
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
    // And calibrated like the note it is attacking, or the layer that is
    // supposed to say "this is what the instrument sounds like at the
    // instant it is struck" says nothing.
    expect(withSeconds!.options.gain).toBeCloseTo(1, 6);

    /*
     * The other half of the crossfade. Both start at the same instant, so
     * a model that came up at full level would be heard as a second strike
     * a few milliseconds after the recording's — which is what the tier is
     * for, and what it was doing: the recorded attack sat eight decibels
     * under the model's own, so the note's attack was the model's.
     */
    const model = fake.notes.find((note) => note.options.seconds === undefined);
    expect(model!.options.attack).toBeCloseTo(withSeconds!.options.seconds!, 6);
    expect(model!.options.gain).toBeUndefined();
  });

  it("starts the model at full volume when it is the whole note", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "synth", sample: "x", takeSample: () => fakeSample() }).noteOn(60);
    expect(fake.notes[0].options.attack).toBeUndefined();
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

  /*
   * A drum has no pitch to resample to, so its recording is the one thing
   * played exactly as recorded — and it comes from a different set of
   * files than the melodic banks, because a General MIDI bank has no
   * percussion at all.
   */
  it("hits a pad with its own recording", () => {
    const fake = fakePlayer();
    const unit = performer(fake.player, {
      tier: "samples",
      takePercussion: (name) => (name === "snare" ? fakeSample({ gain: 3 }) : null)
    });
    unit.strike("snare", "snare", 1900, 0.5);
    expect(fake.notes).toHaveLength(1);
    expect(fake.notes[0].velocity).toBeCloseTo(0.5, 6);
    expect(fake.notes[0].options.gain).toBeCloseTo(3, 6);
    // No pitch to correct, so no playback rate at all.
    expect(fake.notes[0].options.rate).toBeUndefined();
  });

  it("falls back to the model for a pad the kit has no file for", () => {
    const fake = fakePlayer();
    performer(fake.player, { tier: "samples", takePercussion: () => null }).strike(
      "kick",
      "kick",
      55,
      0.9
    );
    expect(fake.notes).toHaveLength(1);
    expect(fake.notes[0].options.rate).toBeUndefined();
    expect(fake.notes[0].options.seconds).toBeUndefined();
  });

  it("still plays a pad on the synth tier without asking for a file", () => {
    const fake = fakePlayer();
    const asked = vi.fn(() => fakeSample());
    performer(fake.player, { tier: "synth", takePercussion: asked }).strike("kick", "kick", 55);
    expect(asked).not.toHaveBeenCalled();
    expect(fake.notes).toHaveLength(1);
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
