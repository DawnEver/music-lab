import { describe, expect, it } from "vitest";
import {
  logFrequencyScale,
  semitoneScale,
  timeScale,
  dbScale,
  frequencyTicks,
  semitoneTicks
} from "../src/lib/plot/scale.js";

describe("log frequency scale", () => {
  const scale = logFrequencyScale(40, 12000);

  it("maps the domain ends to 0 and 1", () => {
    expect(scale.position(40)).toBeCloseTo(0, 6);
    expect(scale.position(12000)).toBeCloseTo(1, 6);
  });

  it("places the geometric mean at the midpoint", () => {
    expect(scale.position(Math.sqrt(40 * 12000))).toBeCloseTo(0.5, 6);
  });

  it("clamps outside the domain", () => {
    expect(scale.position(1)).toBe(0);
    expect(scale.position(48000)).toBe(1);
  });

  it("inverts", () => {
    for (const hz of [50, 220, 440, 1000, 8000]) {
      expect(scale.invert(scale.position(hz))).toBeCloseTo(hz, 6);
    }
  });
});

describe("semitone scale", () => {
  // C2 (midi 36) .. C6 (midi 84)
  const scale = semitoneScale(36, 84);

  it("is linear in semitones, so every octave spans the same distance", () => {
    const a = scale.position(440); // A4, midi 69
    const b = scale.position(880); // A5, midi 81
    const c = scale.position(220); // A3, midi 57
    expect(b - a).toBeCloseTo(a - c, 6);
    expect(b - a).toBeCloseTo(12 / 48, 6);
  });

  it("maps its end notes to 0 and 1", () => {
    expect(scale.position(midi(36))).toBeCloseTo(0, 6);
    expect(scale.position(midi(84))).toBeCloseTo(1, 6);
  });

  it("inverts back to frequency", () => {
    expect(scale.invert(scale.position(440))).toBeCloseTo(440, 6);
  });

  it("honours a non-440 reference", () => {
    const shifted = semitoneScale(36, 84, 442);
    expect(shifted.position(442)).toBeCloseTo(scale.position(440), 6);
  });
});

describe("time and dB scales", () => {
  it("time is linear over the window", () => {
    const scale = timeScale(10, 20);
    expect(scale.position(15)).toBeCloseTo(0.5, 6);
    expect(scale.invert(0.25)).toBeCloseTo(12.5, 6);
  });

  it("dB is linear over the floor..ceiling range", () => {
    const scale = dbScale(-90, -20);
    expect(scale.position(-90)).toBe(0);
    expect(scale.position(-20)).toBe(1);
    expect(scale.position(-55)).toBeCloseTo(0.5, 6);
  });
});

describe("ticks", () => {
  it("only emits frequency ticks inside the domain", () => {
    const ticks = frequencyTicks(logFrequencyScale(80, 5000));
    expect(ticks.length).toBeGreaterThan(2);
    for (const tick of ticks) {
      expect(tick.value).toBeGreaterThanOrEqual(80);
      expect(tick.value).toBeLessThanOrEqual(5000);
      expect(tick.position).toBeGreaterThanOrEqual(0);
      expect(tick.position).toBeLessThanOrEqual(1);
    }
    expect(ticks.some((tick) => tick.label === "1k")).toBe(true);
  });

  it("labels semitone ticks with note names and marks naturals", () => {
    const ticks = semitoneTicks(semitoneScale(57, 69));
    const labels = ticks.map((tick) => tick.label);
    expect(labels[0]).toBe("A3");
    expect(labels[labels.length - 1]).toBe("A4");
    expect(labels).toContain("C4");
    // Accidentals are still emitted, but flagged so the renderer can dim them.
    const cSharp = ticks.find((tick) => tick.label === "C♯4");
    expect(cSharp?.accidental).toBe(true);
    expect(ticks.find((tick) => tick.label === "C4")?.accidental).toBe(false);
  });

  it("thins semitone ticks when the range is wide", () => {
    const wide = semitoneTicks(semitoneScale(24, 96));
    expect(wide.every((tick) => tick.accidental === false)).toBe(true);
    expect(wide.length).toBeLessThan(40);
  });
});

function midi(value: number, tuning = 440): number {
  return tuning * Math.pow(2, (value - 69) / 12);
}
