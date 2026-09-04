import { describe, expect, it, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useTuner } from "../src/features/tuning/stores/tuner.js";
import { pitchRef } from "../src/audio/analysis.js";
import { midiToFrequency } from "../src/lib/music-theory.js";

const tuner = useTuner();

function emit(midi: number, confidence = 0.9): Promise<void> {
  pitchRef.value = { frequency: midiToFrequency(midi, 440), confidence, clarity: confidence } as never;
  return nextTick();
}

/** Index of a harmonica cell in the current target list. */
function cell(hole: number, column: "blow" | "draw"): number {
  return tuner.targets.value.findIndex(
    (target) => target.slot?.row === hole && target.slot?.column === column
  );
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

  it("selecting a target pins it regardless of the played note", async () => {
    await emit(60);
    tuner.selectTarget(cell(4, "draw"));
    await emit(60);
    expect(tuner.needleTarget.value?.target.slot).toEqual({ row: 4, column: "draw" });
    expect(tuner.needleTarget.value?.midi).toBe(74); // D5
  });

  it("clearing the manual selection returns to auto-follow", async () => {
    tuner.selectTarget(cell(4, "draw"));
    tuner.clearSelection();
    await emit(60);
    expect(tuner.needleTarget.value?.target.slot).toEqual({ row: 1, column: "blow" });
  });

  it("a bend position can be pinned, and the needle measures against it", async () => {
    const hole3 = cell(3, "draw");
    tuner.selectTarget(hole3, 1); // B♭4, the half-step bend
    await emit(70);
    expect(tuner.needleTarget.value?.position.kind).toBe("bend");
    expect(Math.abs(tuner.needleTarget.value!.cents)).toBeLessThan(0.01);
  });

  it("switching the layout variant re-tunes the same hole", async () => {
    const before = tuner.targets.value[cell(3, "blow")].positions[0].midi;
    tuner.setVariant("paddy");
    await nextTick();
    const after = tuner.targets.value[cell(3, "blow")].positions[0].midi;
    expect(before).toBe(67); // G4, Richter
    expect(after).toBe(69); //  A4, Paddy Richter
    tuner.setVariant("standard");
  });
});

describe("string instrument targeting", () => {
  beforeEach(async () => {
    tuner.setInstrument("guitar");
    tuner.setPreset("standard");
    tuner.autoMode.value || tuner.toggleAuto();
    pitchRef.value = null;
    await nextTick();
  });

  it("auto-follows to the nearest string", async () => {
    await emit(64); // E4, string 1
    expect(tuner.needleTarget.value?.targetIndex).toBe(5);
    expect(tuner.needleTarget.value?.label.en).toBe("1");
  });

  it("the same selection API works for strings and holes", async () => {
    tuner.selectTarget(0); // low E2
    await emit(64);
    expect(tuner.needleTarget.value?.midi).toBe(40);
    expect(tuner.needleTarget.value?.cents).toBeGreaterThan(2300); // two octaves sharp
  });

  it("switching instruments drops the pinned target", async () => {
    tuner.selectTarget(0);
    tuner.setInstrument("ukulele");
    await nextTick();
    expect(tuner.selection.value).toBeNull();
    await emit(69); // A4, ukulele string 1
    expect(tuner.needleTarget.value?.midi).toBe(69);
  });
});
