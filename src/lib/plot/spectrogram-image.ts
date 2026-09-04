/**
 * Columns of bands -> an RGBA image.
 *
 * Pure: no canvas, no DOM. Rendering the whole visible window every frame
 * (rather than scrolling the canvas by a pixel) is what makes the time
 * window a zoom, freezing possible and replay identical to live — and it
 * keeps the expensive part unit-testable.
 */

import { clamp } from "../dsp-core.js";
import type { SpectrogramColumn } from "../spectrogram.js";
import type { Scale } from "./scale.js";

export interface SpectrogramImageOptions {
  width: number;
  height: number;
  /** Time window, in audio-clock seconds. */
  startTime: number;
  endTime: number;
  /** Vertical mapping: log frequency or semitones. */
  frequency: Scale;
  /** Centre frequency of each band in a column. */
  bandCentres: Float32Array;
  floorDb: number;
  ceilingDb: number;
  /** RGBA lookup table from `colormapLut`. */
  lut: Uint8ClampedArray;
}

export interface SpectrogramImage {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

export function spectrogramImage(
  columns: readonly SpectrogramColumn[],
  options: SpectrogramImageOptions
): SpectrogramImage {
  const { width, height, startTime, endTime, frequency, bandCentres, lut } = options;
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const steps = lut.length / 4;
  const span = Math.max(endTime - startTime, 1e-6);
  const dbSpan = Math.max(options.ceilingDb - options.floorDb, 1e-6);

  // Which band each pixel row reads. The band axis is fixed, so this is one
  // pass per frame rather than a lookup per pixel.
  const rowBand = new Int32Array(height);
  for (let y = 0; y < height; y += 1) {
    const unit = height === 1 ? 0 : 1 - y / (height - 1);
    const hz = frequency.invert(unit);
    rowBand[y] = nearestBand(bandCentres, hz);
  }

  // Paint the floor first: gaps in the history must read as silence, not as
  // holes in the page.
  const floor = [lut[0], lut[1], lut[2]];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = floor[0];
    data[i + 1] = floor[1];
    data[i + 2] = floor[2];
    data[i + 3] = 255;
  }

  for (const column of columns) {
    const unit = (column.time - startTime) / span;
    if (unit < 0 || unit > 1) continue;
    const x = Math.min(width - 1, Math.max(0, Math.round(unit * (width - 1))));
    for (let y = 0; y < height; y += 1) {
      const db = column.db[rowBand[y]];
      const level = clamp((db - options.floorDb) / dbSpan, 0, 1);
      const entry = Math.min(steps - 1, Math.round(level * (steps - 1))) * 4;
      const index = (y * width + x) * 4;
      data[index] = lut[entry];
      data[index + 1] = lut[entry + 1];
      data[index + 2] = lut[entry + 2];
    }
  }

  return { data, width, height };
}

/** Binary search over the geometric band centres. */
function nearestBand(centres: Float32Array, hz: number): number {
  let low = 0;
  let high = centres.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (centres[mid] > hz) high = mid;
    else low = mid;
  }
  return Math.abs(centres[low] - hz) <= Math.abs(centres[high] - hz) ? low : high;
}
