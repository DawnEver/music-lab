import { beforeEach, describe, expect, it } from "vitest";

describe("the tier setting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps only the three it knows, and starts on the model", async () => {
    const store = await import("../../src/features/play/stores/play.js");
    expect(store.settings.voiceTier).toBe("samples");
    expect(store.VOICE_TIERS).toEqual(["samples", "hybrid", "synth"]);

    store.setVoiceTier("synth");
    expect(store.settings.voiceTier).toBe("synth");

    // A tier from a future version, or a typo, is not a tier.
    store.setVoiceTier("orchestra" as never);
    expect(store.settings.voiceTier).toBe("synth");
  });

  it("reads back what was stored, and refuses what was not", async () => {
    window.localStorage.setItem("ml.play", JSON.stringify({ voiceTier: "hybrid" }));
    const store = await import("../../src/features/play/stores/play.js");
    store.hydratePlay(1280);
    expect(store.settings.voiceTier).toBe("hybrid");

    window.localStorage.setItem("ml.play", JSON.stringify({ voiceTier: "vinyl" }));
    store.hydratePlay(1280);
    expect(store.settings.voiceTier).toBe("samples");
  });
});
