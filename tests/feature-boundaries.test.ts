import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("feature boundaries", () => {
  it("keeps application entry and shared toast independent of tuning", () => {
    const main = readFileSync("src/main.ts", "utf8");
    const toast = readFileSync("src/composables/useToast.ts", "utf8");

    expect(main).not.toContain("features/tuning");
    expect(toast).not.toContain("features/tuning");
  });

  it("keeps tuning composables inside the tuning feature", () => {
    expect(() => readFileSync("src/composables/useAudio.ts", "utf8")).toThrow();
    expect(() => readFileSync("src/composables/useTuner.ts", "utf8")).toThrow();
  });

  it("keeps DSP and real-time analysis modules focused", () => {
    const focusedModules = [
      "src/lib/dsp.ts",
      "src/lib/dsp-core.ts",
      "src/lib/pitch-detection.ts",
      "src/lib/spectrum-analysis.ts",
      "src/lib/key.ts",
      "src/lib/key-tracker.ts",
      "src/lib/analysis-loop.ts",
      "src/lib/analysis-stabilizers.ts",
      "src/features/tuning/stores/audio.ts",
      "src/features/tuning/stores/audio-state.ts",
      "src/features/tuning/stores/device-discovery.ts"
    ];

    for (const path of focusedModules) {
      const lineCount = readFileSync(path, "utf8").split("\n").length;
      expect(lineCount, path).toBeLessThanOrEqual(300);
    }
  });
});
