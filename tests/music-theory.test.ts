import { describe, expect, it } from "vitest";
import {
  NOTE_NAMES,
  CHORD_TYPES,
  midiToFrequency,
  frequencyToMidi,
  frequencyToNote
} from "../src/lib/music-theory.js";

describe("frequencyToNote", () => {
  it("resolves 440 Hz to A4 with ~0 cents", () => {
    const note = frequencyToNote(440);
    expect(note.name).toBe("A");
    expect(note.octave).toBe(4);
    expect(note.midi).toBe(69);
    expect(Math.abs(note.cents)).toBeLessThan(0.01);
  });

  it("custom A4 tuning shifts the reference", () => {
    const note = frequencyToNote(442, 442);
    expect(note.name).toBe("A");
    expect(note.octave).toBe(4);
    expect(Math.abs(note.cents)).toBeLessThan(0.01);
  });

  it("note names and octaves across the range", () => {
    expect(frequencyToNote(261.6255653005986).name).toBe("C");
    expect(frequencyToNote(261.6255653005986).octave).toBe(4);
    expect(frequencyToNote(110).name).toBe("A");
    expect(frequencyToNote(110).octave).toBe(2);
    expect(frequencyToNote(523.2511306011972).name).toBe("C");
    expect(frequencyToNote(523.2511306011972).octave).toBe(5);
  });

  it("cents deviation is reported for detuned input", () => {
    const note = frequencyToNote(450);
    expect(note.cents).toBeGreaterThan(10);
  });
});

describe("MIDI conversions", () => {
  it("midiToFrequency and frequencyToMidi round-trip", () => {
    for (let midi = 21; midi <= 108; midi += 1) {
      const frequency = midiToFrequency(midi);
      expect(Math.abs(frequencyToMidi(frequency) - midi)).toBeLessThan(1e-9);
    }
  });
});

describe("chord templates", () => {
  it("are internally consistent", () => {
    expect(NOTE_NAMES).toHaveLength(12);
    for (const type of CHORD_TYPES) {
      expect(type.intervals).toHaveLength(type.weights.length);
      expect(type.intervals.every((i) => i >= 0 && i <= 11)).toBe(true);
      expect(type.weights.every((w) => w > 0 && w <= 1)).toBe(true);
      expect(typeof type.key).toBe("string");
      expect(type.key.length).toBeGreaterThan(0);
    }
  });
});
