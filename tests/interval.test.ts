import { describe, expect, it } from "vitest";
import {
  INTERVALS,
  intervalBySemitones,
  intervalKey,
  semitonesBetween,
  type IntervalKey
} from "../src/lib/interval.js";

describe("intervals", () => {
  it("covers every semitone from unison to the octave, once", () => {
    expect(INTERVALS.map((entry) => entry.semitones)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    ]);
  });

  it("names them", () => {
    expect(intervalKey(7)).toBe("P5");
    expect(intervalKey(4)).toBe("M3");
    expect(intervalKey(3)).toBe("m3");
    expect(intervalKey(12)).toBe("P8");
  });

  it("reduces compound intervals into the octave", () => {
    // A tenth is a third an octave up: the ear names the quality first.
    expect(intervalKey(16)).toBe("M3");
    expect(intervalKey(19)).toBe("P5");
    expect(intervalKey(24)).toBe("P8");
  });

  it("treats direction as distance, not sign", () => {
    expect(intervalKey(-7)).toBe("P5");
  });

  it("looks an interval up by size", () => {
    expect(intervalBySemitones(9)?.key).toBe("M6");
    expect(intervalBySemitones(13)?.key).toBe("m2");
  });

  it("measures between two midi notes", () => {
    expect(semitonesBetween(60, 67)).toBe(7);
    expect(semitonesBetween(67, 60)).toBe(-7);
  });

  it("orders by size, so a difficulty ladder can slice it", () => {
    const keys: IntervalKey[] = INTERVALS.map((entry) => entry.key);
    expect(keys[0]).toBe("P1");
    expect(keys[keys.length - 1]).toBe("P8");
  });
});
