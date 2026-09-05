import { describe, expect, it } from "vitest";
import {
  COLORMAP_IDS,
  COLORMAP_POLARITY,
  colormapLut,
  defaultColormap,
  sampleColormap
} from "../src/lib/colormap.js";

function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("colormaps", () => {
  it("offers every id the dictionary must cover", () => {
    expect(COLORMAP_IDS).toEqual([
      "magma",
      "viridis",
      "inferno",
      "ice",
      "gray",
      "paper",
      "ink"
    ]);
  });

  it("picks a ramp built for the page it will sit on", () => {
    // A dark-floor ramp on a light page is a black rectangle in the layout.
    expect(COLORMAP_POLARITY[defaultColormap("onDark")]).toBe("onDark");
    expect(COLORMAP_POLARITY[defaultColormap("onLight")]).toBe("onLight");
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

      it("moves through luminance in one direction only", () => {
        // Monotonic luminance is what makes the colour bar readable as a dB
        // axis; the direction depends on the page it is drawn on.
        const rising = COLORMAP_POLARITY[id] === "onDark";
        let previous = rising ? -1 : 256;
        for (let i = 0; i <= 32; i += 1) {
          const value = luminance(sampleColormap(id, i / 32));
          if (rising) expect(value).toBeGreaterThan(previous - 1e-6);
          else expect(value).toBeLessThan(previous + 1e-6);
          previous = value;
        }
      });

      it("starts where the page is and ends far from it", () => {
        const quiet = luminance(sampleColormap(id, 0));
        const loud = luminance(sampleColormap(id, 1));
        if (COLORMAP_POLARITY[id] === "onDark") {
          expect(quiet).toBeLessThan(70);
          expect(loud).toBeGreaterThan(180);
        } else {
          expect(quiet).toBeGreaterThan(180);
          expect(loud).toBeLessThan(70);
        }
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
