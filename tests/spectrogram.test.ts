import { describe, expect, it } from "vitest";
import {
  SpectrogramBuffer,
  bandFrequencies,
  reduceToLogBands,
  type SpectrogramColumn
} from "../src/lib/spectrogram.js";

const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;

/** A synthetic FFT magnitude frame with a single peak at `hz`. */
function frameWithPeak(hz: number, floorDb = -120, peakDb = -10): Float32Array {
  const bins = FFT_SIZE / 2;
  const data = new Float32Array(bins).fill(floorDb);
  data[Math.round(hz / (SAMPLE_RATE / FFT_SIZE))] = peakDb;
  return data;
}

describe("log band reduction", () => {
  const options = { sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE, minHz: 40, maxHz: 12000, bands: 256 };

  it("produces one value per band", () => {
    expect(reduceToLogBands(frameWithPeak(440), options).length).toBe(256);
  });

  it("puts a tone's energy in the band that contains it", () => {
    const bands = reduceToLogBands(frameWithPeak(1000), options);
    const centres = bandFrequencies(options);
    let loudest = 0;
    for (let i = 1; i < bands.length; i += 1) if (bands[i] > bands[loudest]) loudest = i;
    // Within one band of 1 kHz on a 256-band log axis spanning 40..12000 Hz.
    expect(Math.abs(Math.log2(centres[loudest] / 1000))).toBeLessThan(
      Math.log2(12000 / 40) / 256 + 1e-9
    );
    expect(bands[loudest]).toBeCloseTo(-10, 5);
  });

  it("keeps the peak when several bins fall in one band, rather than averaging it away", () => {
    // High bands are wide: a lone peak must survive the reduction.
    const bands = reduceToLogBands(frameWithPeak(9000), options);
    expect(Math.max(...bands)).toBeCloseTo(-10, 5);
  });

  it("replaces non-finite bins with the floor", () => {
    const data = frameWithPeak(440);
    data[3] = Number.NEGATIVE_INFINITY;
    data[4] = Number.NaN;
    const bands = reduceToLogBands(data, options);
    expect(bands.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("reuses a caller-supplied output buffer", () => {
    const out = new Float32Array(256);
    expect(reduceToLogBands(frameWithPeak(440), options, out)).toBe(out);
  });

  it("spaces band centres geometrically", () => {
    const centres = bandFrequencies(options);
    expect(centres[0]).toBeCloseTo(40, 6);
    expect(centres[255]).toBeCloseTo(12000, 6);
    const ratio = centres[1] / centres[0];
    expect(centres[100] / centres[99]).toBeCloseTo(ratio, 6);
  });
});

describe("spectrogram buffer", () => {
  function column(time: number, pitchHz: number | null = null): SpectrogramColumn {
    return { time, db: new Float32Array([time]), pitchHz };
  }

  it("starts empty", () => {
    const buffer = new SpectrogramBuffer(4);
    expect(buffer.size).toBe(0);
    expect(buffer.window(1, 1)).toEqual([]);
    expect(buffer.span()).toBeNull();
  });

  it("overwrites the oldest column once full", () => {
    const buffer = new SpectrogramBuffer(3);
    for (const time of [1, 2, 3, 4, 5]) buffer.push(column(time));
    expect(buffer.size).toBe(3);
    expect(buffer.columns().map((entry) => entry.time)).toEqual([3, 4, 5]);
    expect(buffer.span()).toEqual({ start: 3, end: 5 });
  });

  it("returns only the requested time window, oldest first", () => {
    const buffer = new SpectrogramBuffer(10);
    for (let time = 0; time < 10; time += 1) buffer.push(column(time));
    expect(buffer.window(9, 3).map((entry) => entry.time)).toEqual([6, 7, 8, 9]);
  });

  it("windows around a past instant, so a frozen view can scrub", () => {
    const buffer = new SpectrogramBuffer(10);
    for (let time = 0; time < 10; time += 1) buffer.push(column(time));
    expect(buffer.window(5, 2).map((entry) => entry.time)).toEqual([3, 4, 5]);
  });

  it("clears", () => {
    const buffer = new SpectrogramBuffer(3);
    buffer.push(column(1));
    buffer.clear();
    expect(buffer.size).toBe(0);
  });

  it("sizes itself from a duration and a capture rate", () => {
    const buffer = SpectrogramBuffer.forDuration(60, 30);
    expect(buffer.capacity).toBe(1800);
  });

  it("copies a window out as an immutable take", () => {
    const buffer = new SpectrogramBuffer(10);
    for (let time = 0; time < 10; time += 1) buffer.push(column(time, 440));
    const take = buffer.take(9, 3);
    expect(take.duration).toBeCloseTo(3, 6);
    expect(take.columns.map((entry) => entry.time)).toEqual([0, 1, 2, 3]);
    // Times are rebased to the take, and the take survives further pushes.
    buffer.push(column(10));
    expect(take.columns.length).toBe(4);
  });
});
