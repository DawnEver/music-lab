import { describe, expect, it } from "vitest";
import { TIMBRES, getTimbre, timbreSpec, DEFAULT_TIMBRE_ID } from "../src/audio/timbre.js";
import { midiToFrequency } from "../src/lib/music-theory.js";

describe("timbre registry", () => {
  it("has unique ids and a valid default", () => {
    const ids = TIMBRES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_TIMBRE_ID);
  });

  it("falls back to the default for an unknown id", () => {
    expect(getTimbre("nope").id).toBe(DEFAULT_TIMBRE_ID);
  });

  it("every timbre keeps its levels in range", () => {
    for (const entry of TIMBRES) {
      expect(entry.gain, entry.id).toBeGreaterThan(0);
      expect(entry.gain, entry.id).toBeLessThanOrEqual(1);
      if (entry.sustain !== undefined) {
        expect(entry.sustain, entry.id).toBeGreaterThan(0);
        expect(entry.sustain, entry.id).toBeLessThanOrEqual(1);
      }
      for (const relative of entry.partials ?? []) {
        expect(relative, entry.id).toBeGreaterThanOrEqual(0);
        expect(relative, entry.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("timbreSpec", () => {
  it("puts the note at its tuned frequency", () => {
    const spec = timbreSpec(getTimbre("singable"), 69, 0.5, 442);
    expect(spec.frequency).toBeCloseTo(midiToFrequency(69, 442), 6);
    expect(spec.duration).toBe(0.5);
  });

  it("reproduces the ear trainer's original singable tone", () => {
    const spec = timbreSpec(getTimbre("singable"), 60, 0.4);
    expect(spec.waveform).toBe("sine");
    expect(spec.gain).toBeCloseTo(0.32, 6);
    expect(spec.attack).toBeCloseTo(0.02, 6);
    expect(spec.partials).toEqual([0.34, 0.16, 0.07]);
  });
});
