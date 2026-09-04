import { describe, expect, it } from "vitest";
import { COLORMAP_IDS, colormapLut, sampleColormap } from "../src/lib/colormap.js";

function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("colormaps", () => {
  it("offers every id the dictionary must cover", () => {
    expect(COLORMAP_IDS).toEqual(["magma", "viridis", "inferno", "ice", "gray"]);
  });

  for (const id of COLORMAP_IDS) {
    describe(id, () => {
      it("stays inside the 0..255 channel range", () => {
        for (let i = 0; i <= 20; i += 1) {
          for (const channel of sampleColormap(id, i / 20)) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(255);
            expect(Number.isFinite(channel)).toBe(true);
          }
        }
      });

      it("clamps out-of-range input to the ramp ends", () => {
        expect(sampleColormap(id, -3)).toEqual(sampleColormap(id, 0));
        expect(sampleColormap(id, 7)).toEqual(sampleColormap(id, 1));
      });

      it("rises in luminance, so louder always reads brighter", () => {
        // Perceptual uniformity is the point of these ramps: a monotonic
        // luminance is what makes the colour bar readable as a dB axis.
        let previous = -1;
        for (let i = 0; i <= 32; i += 1) {
          const value = luminance(sampleColormap(id, i / 32));
          expect(value).toBeGreaterThan(previous - 1e-6);
          previous = value;
        }
      });

      it("starts dark and ends bright", () => {
        expect(luminance(sampleColormap(id, 0))).toBeLessThan(70);
        expect(luminance(sampleColormap(id, 1))).toBeGreaterThan(180);
      });
    });
  }

  it("builds a lookup table matching the sampler", () => {
    const lut = colormapLut("magma", 64);
    expect(lut.length).toBe(64 * 4);
    const [r, g, b] = sampleColormap("magma", 32 / 63);
    expect(lut[32 * 4]).toBe(r);
    expect(lut[32 * 4 + 1]).toBe(g);
    expect(lut[32 * 4 + 2]).toBe(b);
    expect(lut[32 * 4 + 3]).toBe(255);
  });
});
