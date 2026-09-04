import { describe, expect, it } from "vitest";
import { plotBox, unitToX, unitToY, xToUnit, yToUnit } from "../src/lib/plot/canvas.js";

const box = plotBox(600, 400, { left: 50, right: 10, top: 20, bottom: 40 }, 1);

describe("plot box", () => {
  it("subtracts the gutters from the drawable area", () => {
    expect(box.width).toBe(540);
    expect(box.height).toBe(340);
  });

  it("scales insets by the device pixel ratio", () => {
    const retina = plotBox(1200, 800, { left: 50, right: 10, top: 20, bottom: 40 }, 2);
    expect(retina.left).toBe(100);
    expect(retina.width).toBe(1080);
  });

  it("maps unit space onto the plot area, with y rising upward", () => {
    expect(unitToX(box, 0)).toBe(50);
    expect(unitToX(box, 1)).toBe(590);
    expect(unitToY(box, 0)).toBe(360);
    expect(unitToY(box, 1)).toBe(20);
  });

  it("round-trips through the inverses", () => {
    expect(xToUnit(box, unitToX(box, 0.3))).toBeCloseTo(0.3, 9);
    expect(yToUnit(box, unitToY(box, 0.3))).toBeCloseTo(0.3, 9);
  });

  it("clamps outside the box", () => {
    expect(unitToX(box, 5)).toBe(590);
    expect(xToUnit(box, -100)).toBe(0);
  });
});
