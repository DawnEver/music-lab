/**
 * Perceptually-ordered colour ramps for the spectrogram.
 *
 * A ramp is plain data — a list of anchor colours — so adding one is a data
 * change. The one property every ramp must hold is monotonically rising
 * luminance: the colour bar is a dB axis, and an axis that dips is a lie.
 */

import { clamp } from "./dsp-core.js";

export type ColormapId = "magma" | "viridis" | "inferno" | "ice" | "gray";

/** Closed set: the dictionary carries a `colormap.<id>` for each. */
export const COLORMAP_IDS: ColormapId[] = ["magma", "viridis", "inferno", "ice", "gray"];

export type Rgb = [number, number, number];

const RAMPS: Record<ColormapId, Rgb[]> = {
  magma: [
    [0, 0, 4],
    [28, 16, 68],
    [79, 18, 123],
    [129, 37, 129],
    [181, 54, 122],
    [229, 80, 100],
    [251, 135, 97],
    [254, 194, 135],
    [252, 253, 191]
  ],
  inferno: [
    [0, 0, 4],
    [31, 12, 72],
    [85, 15, 109],
    [136, 34, 106],
    [186, 54, 85],
    [227, 89, 51],
    [249, 142, 9],
    [249, 201, 50],
    [252, 255, 164]
  ],
  viridis: [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [253, 231, 37]
  ],
  ice: [
    [2, 6, 24],
    [10, 45, 90],
    [16, 96, 150],
    [70, 170, 200],
    [240, 252, 255]
  ],
  gray: [
    [0, 0, 0],
    [255, 255, 255]
  ]
};

/** Sample a ramp at `t` in 0..1 (clamped). */
export function sampleColormap(id: ColormapId, t: number): Rgb {
  const ramp = RAMPS[id] ?? RAMPS.magma;
  const scaled = clamp(t, 0, 1) * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const from = ramp[index];
  const to = ramp[index + 1];
  return [
    Math.round(from[0] + (to[0] - from[0]) * fraction),
    Math.round(from[1] + (to[1] - from[1]) * fraction),
    Math.round(from[2] + (to[2] - from[2]) * fraction)
  ];
}

/**
 * Flatten a ramp to RGBA bytes so the spectrogram renderer can index it per
 * pixel without allocating.
 */
export function colormapLut(id: ColormapId, steps = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(steps * 4);
  for (let i = 0; i < steps; i += 1) {
    const [r, g, b] = sampleColormap(id, i / (steps - 1));
    lut[i * 4] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = b;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}
