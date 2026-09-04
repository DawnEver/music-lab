import { describe, expect, it } from "vitest";
import { spectrogramImage } from "../src/lib/plot/spectrogram-image.js";
import { bandFrequencies, type SpectrogramColumn } from "../src/lib/spectrogram.js";
import { logFrequencyScale } from "../src/lib/plot/scale.js";
import { colormapLut } from "../src/lib/colormap.js";

const BANDS = 32;
const OPTIONS = { sampleRate: 48000, fftSize: 2048, minHz: 40, maxHz: 12000, bands: BANDS };
const CENTRES = bandFrequencies(OPTIONS);

function column(time: number, loudBand: number, db = -20): SpectrogramColumn {
  const bands = new Float32Array(BANDS).fill(-120);
  bands[loudBand] = db;
  return { time, db: bands, pitchHz: null };
}

function pixel(image: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  const index = (y * image.width + x) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2], image.data[index + 3]];
}

const base = {
  width: 40,
  height: 20,
  frequency: logFrequencyScale(40, 12000),
  bandCentres: CENTRES,
  floorDb: -90,
  ceilingDb: -10,
  lut: colormapLut("gray", 256)
};

describe("spectrogram image", () => {
  it("fills an RGBA buffer of the requested size", () => {
    const image = spectrogramImage([column(1, 10)], { ...base, startTime: 0, endTime: 2 });
    expect(image.width).toBe(40);
    expect(image.height).toBe(20);
    expect(image.data.length).toBe(40 * 20 * 4);
  });

  it("is fully opaque, so a partial window never shows the page through it", () => {
    const image = spectrogramImage([column(1, 10)], { ...base, startTime: 0, endTime: 2 });
    for (let i = 3; i < image.data.length; i += 4) expect(image.data[i]).toBe(255);
  });

  it("puts later columns further right", () => {
    const columns = [column(0.1, 5), column(1.9, 5)];
    const image = spectrogramImage(columns, { ...base, startTime: 0, endTime: 2 });
    // Nothing is drawn where no column falls, so an empty middle stays at
    // the floor colour while both ends are lit.
    const brightest = (x: number) =>
      Math.max(...Array.from({ length: 20 }, (_, y) => pixel(image, x, y)[0]));
    expect(brightest(2)).toBeGreaterThan(brightest(20));
    expect(brightest(37)).toBeGreaterThan(brightest(20));
  });

  it("puts higher frequencies further up", () => {
    const image = spectrogramImage([column(1, BANDS - 1)], { ...base, startTime: 0, endTime: 2 });
    const top = pixel(image, 20, 0)[0];
    const bottom = pixel(image, 20, 19)[0];
    expect(top).toBeGreaterThan(bottom);
  });

  it("maps dB to the ramp: louder is brighter", () => {
    const quiet = spectrogramImage([column(1, 10, -70)], { ...base, startTime: 0, endTime: 2 });
    const loud = spectrogramImage([column(1, 10, -15)], { ...base, startTime: 0, endTime: 2 });
    const brightest = (image: { data: Uint8ClampedArray; width: number }) =>
      Math.max(...Array.from({ length: 20 }, (_, y) => pixel(image, 20, y)[0]));
    expect(brightest(loud)).toBeGreaterThan(brightest(quiet));
  });

  it("clamps beyond the dB range instead of wrapping", () => {
    const image = spectrogramImage([column(1, 10, 40)], { ...base, startTime: 0, endTime: 2 });
    const brightest = Math.max(...Array.from({ length: 20 }, (_, y) => pixel(image, 20, y)[0]));
    expect(brightest).toBe(255);
  });

  it("renders an empty window as the floor colour rather than throwing", () => {
    const image = spectrogramImage([], { ...base, startTime: 0, endTime: 2 });
    expect(image.data[0]).toBe(0);
    expect(image.data[3]).toBe(255);
  });

  it("survives a window shorter than one pixel", () => {
    const image = spectrogramImage([column(1, 4)], { ...base, startTime: 1, endTime: 1 });
    expect(image.data.length).toBe(40 * 20 * 4);
  });
});
