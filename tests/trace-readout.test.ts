import { describe, expect, it } from "vitest";
import { readoutAt, TRACE_INSETS } from "../src/lib/plot/trace.js";
import { logFrequencyScale } from "../src/lib/plot/scale.js";
import { plotBox } from "../src/lib/plot/canvas.js";
import { bandFrequencies } from "../src/lib/spectrogram.js";

const OPTIONS = { sampleRate: 48000, fftSize: 2048, minHz: 40, maxHz: 12000, bands: 256 };
const centres = bandFrequencies(OPTIONS);
const area = plotBox(600, 400, TRACE_INSETS, 1);
const frequency = logFrequencyScale(40, 12000);

const columns = [
  { time: 5, db: new Float32Array(256).fill(-70), pitchHz: 440 },
  { time: 6, db: new Float32Array(256).fill(-30), pitchHz: 880 }
];

const base = {
  area,
  frequency,
  bandCentres: centres,
  columns,
  startTime: 4,
  endTime: 7,
  tuning: 440
};

describe("scope readout", () => {
  it("is null outside the plot area, so the gutters do not lie", () => {
    expect(readoutAt(10, 10, base)).toBeNull();
    expect(readoutAt(599, 399, base)).toBeNull();
  });

  it("reads the time back from the x position", () => {
    const middle = readoutAt(area.left + area.width / 2, area.top + 10, base)!;
    expect(middle.time).toBeCloseTo(5.5, 6);
    // Also expressed as an age, which is what a scrolling axis means.
    expect(middle.secondsAgo).toBeCloseTo(1.5, 6);
  });

  it("reads the frequency back from the y position, and names the note", () => {
    const y = area.top + (1 - frequency.position(440)) * area.height;
    const readout = readoutAt(area.left + 5, y, base)!;
    expect(readout.hz).toBeCloseTo(440, 0);
    expect(readout.note).toBe("A4");
    expect(Math.abs(readout.cents)).toBeLessThan(20);
  });

  it("reports the level of the nearest column at that band", () => {
    const y = area.top + area.height / 2;
    const atFive = readoutAt(area.left + (1 / 3) * area.width, y, base)!;
    const atSix = readoutAt(area.left + (2 / 3) * area.width, y, base)!;
    expect(atFive.db).toBe(-70);
    expect(atSix.db).toBe(-30);
  });

  it("has no level when nothing was captured near that time", () => {
    expect(readoutAt(area.left + 1, area.top + 5, { ...base, columns: [] })!.db).toBeNull();
  });
});
