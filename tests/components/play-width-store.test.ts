import { beforeEach, describe, expect, it } from "vitest";

/*
 * How wide the player wants a white key, in millimetres. Null is the app's
 * own answer — as wide as the room allows between a fingertip and a real
 * key — and a number is the player's, which stops following the window.
 */
describe("the key width setting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts by asking the room how wide a key can be", async () => {
    const store = await import("../../src/features/play/stores/play.js");
    expect(store.settings.whiteMm).toBeNull();
  });

  it("keeps a width inside the hand, and remembers it", async () => {
    const store = await import("../../src/features/play/stores/play.js");
    store.setWhiteMm(15);
    expect(store.settings.whiteMm).toBe(15);

    // Past a real piano's white key there is nothing to gain.
    store.setWhiteMm(40);
    expect(store.settings.whiteMm).toBe(23.5);

    store.setWhiteMm(null);
    expect(store.settings.whiteMm).toBeNull();
  });

  it("reads back what was stored, and refuses what was not", async () => {
    window.localStorage.setItem("ml.play", JSON.stringify({ whiteMm: 12.5 }));
    const store = await import("../../src/features/play/stores/play.js");
    store.hydratePlay(1280);
    expect(store.settings.whiteMm).toBe(12.5);

    // Out of range is clamped; not a number is the app's answer, because
    // `NaN` reaches CSS as an invalid `calc()` and takes the whole width
    // declaration with it.
    window.localStorage.setItem("ml.play", JSON.stringify({ whiteMm: 1 }));
    store.hydratePlay(1280);
    expect(store.settings.whiteMm).toBe(9);

    window.localStorage.setItem("ml.play", JSON.stringify({ whiteMm: "wide" }));
    store.hydratePlay(1280);
    expect(store.settings.whiteMm).toBeNull();
  });
});
