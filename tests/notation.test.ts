import { describe, expect, it } from "vitest";
import {
  jianpuLayout,
  keySignature,
  staffLayout,
  STAFF_STEPS_PER_OCTAVE
} from "../src/lib/notation.js";
import type { NotatedLine } from "../src/lib/notation.js";

function melodyOf(tonicMidi: number, midis: number[], bpm = 60): NotatedLine {
  const beat = 60 / bpm;
  return {
    tonicMidi,
    bpm,
    notes: midis.map((midi, index) => ({ midi, start: index * beat, duration: beat }))
  };
}

describe("key signatures", () => {
  it("counts sharps and flats around the circle of fifths", () => {
    expect(keySignature(60)).toEqual({ kind: "sharp", count: 0 });
    expect(keySignature(67)).toEqual({ kind: "sharp", count: 1 });
    expect(keySignature(62)).toEqual({ kind: "sharp", count: 2 });
    expect(keySignature(69)).toEqual({ kind: "sharp", count: 3 });
    expect(keySignature(64)).toEqual({ kind: "sharp", count: 4 });
    expect(keySignature(65)).toEqual({ kind: "flat", count: 1 });
    expect(keySignature(70)).toEqual({ kind: "flat", count: 2 });
  });

  it("ignores the octave a tonic is written in", () => {
    expect(keySignature(55)).toEqual(keySignature(67));
  });
});

describe("staff layout", () => {
  const layout = staffLayout(melodyOf(60, [60, 62, 64, 65, 67, 69, 71, 72]));

  it("puts one note per written note, in order", () => {
    expect(layout.notes).toHaveLength(8);
    expect(layout.notes.map((note) => note.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    for (let i = 1; i < layout.notes.length; i += 1) {
      expect(layout.notes[i].x).toBeGreaterThan(layout.notes[i - 1].x);
    }
  });

  it("places pitches by diatonic step, not by semitone", () => {
    // C4 sits one step below the bottom line of the treble staff; every
    // scale degree is one step up from there, so an octave is seven steps.
    const [c4, d4, e4] = layout.notes;
    expect(c4.step).toBe(-2);
    expect(d4.step).toBe(-1);
    expect(e4.step).toBe(0);
    expect(layout.notes[7].step - c4.step).toBe(STAFF_STEPS_PER_OCTAVE);
  });

  it("draws ledger lines for notes off the staff, and none for notes on it", () => {
    expect(layout.notes[0].ledgerSteps).toEqual([-2]);
    expect(layout.notes[2].ledgerSteps).toEqual([]);
    const high = staffLayout(melodyOf(60, [84]));
    expect(high.notes[0].ledgerSteps).toEqual([10, 12]);
  });

  it("spells notes from the key, so a scale reads without accidentals", () => {
    const inD = staffLayout(melodyOf(62, [62, 64, 66, 67]));
    expect(inD.notes.map((note) => note.letter)).toEqual(["D", "E", "F", "G"]);
    expect(inD.notes.every((note) => note.accidental === null)).toBe(true);
    expect(inD.keySignature).toEqual({ kind: "sharp", count: 2 });
  });

  it("marks an accidental only when the note is outside the key", () => {
    const chromatic = staffLayout(melodyOf(60, [61]));
    expect(chromatic.notes[0].accidental).toBe("sharp");
  });

  it("breaks bars from the melody's own beat grid", () => {
    const twoBars = staffLayout(melodyOf(60, [60, 62, 64, 65, 67, 69, 71, 72]));
    expect(twoBars.notes.map((note) => note.bar)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(twoBars.bars).toBe(2);
  });

  it("stems down above the middle line and up below it", () => {
    const wide = staffLayout(melodyOf(60, [60, 83]));
    expect(wide.notes[0].stem).toBe("up");
    expect(wide.notes[1].stem).toBe("down");
  });
});

describe("jianpu layout", () => {
  const layout = jianpuLayout(melodyOf(60, [60, 62, 64, 67, 72, 55]));

  it("numbers the degrees of the key", () => {
    expect(layout.notes.map((note) => note.degree)).toEqual([1, 2, 3, 5, 1, 5]);
  });

  it("marks the octave with dots, above and below", () => {
    expect(layout.notes.map((note) => note.octaveDots)).toEqual([0, 0, 0, 0, 1, -1]);
  });

  it("keeps the same bar grid as the staff", () => {
    expect(layout.notes.map((note) => note.bar)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it("falls back to the nearest degree with an accidental mark", () => {
    const sharp = jianpuLayout(melodyOf(60, [61]));
    expect(sharp.notes[0].degree).toBe(1);
    expect(sharp.notes[0].accidental).toBe("sharp");
  });
});
