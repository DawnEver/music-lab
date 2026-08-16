import { describe, expect, it, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useTuner } from "../src/composables/useTuner.js";
import { pitchRef } from "../src/lib/analysis-loop.js";
import { midiToFrequency } from "../src/lib/music-theory.js";

const tuner = useTuner();

function emit(midi: number, confidence = 0.9): Promise<void> {
  pitchRef.value = { frequency: midiToFrequency(midi, 440), confidence, clarity: confidence } as never;
  return nextTick();
}

describe("harmonica tuner targeting", () => {
  beforeEach(async () => {
    tuner.setInstrument("harmonica");
    tuner.setPreset("C");
    tuner.autoMode.value || tuner.toggleAuto();
    pitchRef.value = null;
    await nextTick();
  });

  it("auto-follows the played note instead of latching on the first match", async () => {
    await emit(60); // hole 1 blow, C4
    expect(tuner.needleTarget.value?.midi).toBe(60);

    await emit(67); // hole 2 draw / hole 3 blow, G4
    expect(tuner.needleTarget.value?.midi).toBe(67);
  });

  it("selecting a cell pins that target regardless of the played note", async () => {
    await emit(60);
    tuner.selectPosition(4, "draw", 0); // D5
    await emit(60);
    expect(tuner.needleTarget.value?.hole).toBe(4);
    expect(tuner.needleTarget.value?.breath).toBe("draw");
  });

  it("clearing the manual selection returns to auto-follow", async () => {
    tuner.selectPosition(4, "draw", 0);
    tuner.clearSelection();
    await emit(60);
    expect(tuner.needleTarget.value?.hole).toBe(1);
  });
});
