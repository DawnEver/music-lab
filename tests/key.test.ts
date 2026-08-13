import { describe, expect, it } from "vitest";
import {
  MODES,
  KeyTracker,
  degreeOf,
  estimateKey,
  type Key
} from "../src/lib/key.js";

const C_MAJOR: Key = { tonic: 0, mode: "major" };
const A_MINOR: Key = { tonic: 9, mode: "minor" };

function chromaOf(pitchClasses: Record<number, number>): Float32Array {
  const chroma = new Float32Array(12);
  for (const [pc, value] of Object.entries(pitchClasses)) {
    chroma[Number(pc)] = value;
  }
  return chroma;
}

describe("modes data", () => {
  it("each mode has 12 numeral labels and consistent degrees", () => {
    for (const mode of Object.values(MODES)) {
      expect(mode.labels).toHaveLength(12);
      for (const degree of mode.degrees) {
        expect(degree.interval).toBeGreaterThanOrEqual(0);
        expect(degree.interval).toBeLessThan(12);
        expect(mode.labels[degree.interval]).toMatch(/[IV]+/);
      }
    }
  });
});

describe("estimateKey", () => {
  it("identifies a C major triad chroma as C major", () => {
    const estimate = estimateKey(chromaOf({ 0: 1, 4: 0.85, 7: 0.8 }));
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toEqual(C_MAJOR);
  });

  it("identifies an A minor triad chroma as A minor", () => {
    const estimate = estimateKey(chromaOf({ 9: 1, 0: 0.85, 4: 0.8 }));
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toEqual(A_MINOR);
  });

  it("returns null for empty chroma", () => {
    expect(estimateKey(new Float32Array(12))).toBeNull();
  });

  it("reports an alternate candidate", () => {
    const estimate = estimateKey(chromaOf({ 0: 1, 4: 0.85, 7: 0.8 }));
    expect(estimate!.alternate).not.toBeNull();
    expect(estimate!.confidence).toBeGreaterThan(0);
    expect(estimate!.confidence).toBeLessThanOrEqual(1);
  });
});

describe("degreeOf in C major", () => {
  it("labels diatonic triads", () => {
    expect(degreeOf(0, "major", C_MAJOR)).toMatchObject({ numeral: "I", diatonic: true });
    expect(degreeOf(2, "minor", C_MAJOR)).toMatchObject({ numeral: "ii", diatonic: true });
    expect(degreeOf(4, "minor", C_MAJOR)).toMatchObject({ numeral: "iii", diatonic: true });
    expect(degreeOf(5, "major", C_MAJOR)).toMatchObject({ numeral: "IV", diatonic: true });
    expect(degreeOf(7, "major", C_MAJOR)).toMatchObject({ numeral: "V", diatonic: true });
    expect(degreeOf(9, "minor", C_MAJOR)).toMatchObject({ numeral: "vi", diatonic: true });
    expect(degreeOf(11, "dim", C_MAJOR)).toMatchObject({ numeral: "vii°", diatonic: true });
  });

  it("labels diatonic seventh chords", () => {
    expect(degreeOf(0, "maj7", C_MAJOR)).toMatchObject({ numeral: "Imaj7", diatonic: true });
    expect(degreeOf(2, "m7", C_MAJOR)).toMatchObject({ numeral: "ii7", diatonic: true });
    expect(degreeOf(7, "dom7", C_MAJOR)).toMatchObject({ numeral: "V7", diatonic: true });
    expect(degreeOf(9, "m7", C_MAJOR)).toMatchObject({ numeral: "vi7", diatonic: true });
  });

  it("marks a major seventh on V as chromatic", () => {
    expect(degreeOf(7, "maj7", C_MAJOR)).toMatchObject({ numeral: "Vmaj7", diatonic: false });
  });

  it("marks non-scale roots with accidentals", () => {
    expect(degreeOf(1, "major", C_MAJOR)).toMatchObject({ numeral: "♭II", diatonic: false });
    expect(degreeOf(10, "major", C_MAJOR)).toMatchObject({ numeral: "♭VII", diatonic: false });
    expect(degreeOf(6, "minor", C_MAJOR)).toMatchObject({ numeral: "♯iv", diatonic: false });
    expect(degreeOf(3, "m7", C_MAJOR)).toMatchObject({ numeral: "♭iii7", diatonic: false });
  });

  it("marks wrong quality on a scale degree as chromatic", () => {
    expect(degreeOf(2, "major", C_MAJOR).diatonic).toBe(false);
    expect(degreeOf(0, "minor", C_MAJOR).diatonic).toBe(false);
  });

  it("detects secondary dominants", () => {
    expect(degreeOf(2, "major", C_MAJOR).secondary).toBe("V/V");
    expect(degreeOf(2, "dom7", C_MAJOR).secondary).toBe("V/V");
    expect(degreeOf(9, "dom7", C_MAJOR).secondary).toBe("V/ii");
    expect(degreeOf(0, "dom7", C_MAJOR).secondary).toBe("V/IV");
    expect(degreeOf(7, "dom7", C_MAJOR).secondary).toBeNull();
    expect(degreeOf(1, "major", C_MAJOR).secondary).toBeNull();
  });

  it("labels sus and power chords", () => {
    expect(degreeOf(0, "sus4", C_MAJOR)).toMatchObject({ numeral: "Isus4", diatonic: true });
    expect(degreeOf(7, "sus2", C_MAJOR)).toMatchObject({ numeral: "Vsus2", diatonic: true });
    expect(degreeOf(7, "fifth", C_MAJOR)).toMatchObject({ numeral: "V5", diatonic: true });
    expect(degreeOf(6, "sus4", C_MAJOR)).toMatchObject({ numeral: "♯IVsus4", diatonic: false });
  });

  it("labels augmented triads", () => {
    expect(degreeOf(0, "aug", C_MAJOR)).toMatchObject({ numeral: "I+", diatonic: false });
  });
});

describe("degreeOf in A minor", () => {
  it("labels natural-minor diatonic chords", () => {
    expect(degreeOf(9, "minor", A_MINOR)).toMatchObject({ numeral: "i", diatonic: true, variant: "natural" });
    expect(degreeOf(0, "major", A_MINOR)).toMatchObject({ numeral: "III", diatonic: true, variant: "natural" });
    expect(degreeOf(5, "major", A_MINOR)).toMatchObject({ numeral: "VI", diatonic: true, variant: "natural" });
    expect(degreeOf(7, "major", A_MINOR)).toMatchObject({ numeral: "VII", diatonic: true, variant: "natural" });
    expect(degreeOf(2, "m7", A_MINOR)).toMatchObject({ numeral: "iv7", diatonic: true, variant: "natural" });
  });

  it("labels harmonic-minor variants", () => {
    expect(degreeOf(4, "major", A_MINOR)).toMatchObject({ numeral: "V", diatonic: true, variant: "harmonic" });
    expect(degreeOf(4, "dom7", A_MINOR)).toMatchObject({ numeral: "V7", diatonic: true, variant: "harmonic" });
    expect(degreeOf(8, "dim", A_MINOR)).toMatchObject({ numeral: "♯vii°", diatonic: true, variant: "harmonic" });
  });

  it("marks the natural minor v as a distinct variant from harmonic V", () => {
    expect(degreeOf(4, "minor", A_MINOR)).toMatchObject({ numeral: "v", diatonic: true, variant: "natural" });
  });

  it("detects secondary dominants in minor", () => {
    expect(degreeOf(11, "major", A_MINOR).secondary).toBe("V/v");
    expect(degreeOf(4, "major", A_MINOR).secondary).toBeNull();
  });
});

describe("KeyTracker", () => {
  it("estimates a key after sustained input", () => {
    const tracker = new KeyTracker();
    const chroma = chromaOf({ 0: 1, 4: 0.85, 7: 0.8 });
    let estimate = null as ReturnType<KeyTracker["estimate"]>;
    for (let frame = 0; frame < 10; frame += 1) {
      tracker.push(chroma, frame * 100);
      estimate = tracker.estimate();
    }
    expect(estimate).not.toBeNull();
    expect(estimate!.key).toEqual(C_MAJOR);
  });

  it("does not switch keys on a single contrary frame", () => {
    const tracker = new KeyTracker();
    const cMajor = chromaOf({ 0: 1, 4: 0.85, 7: 0.8 });
    const fSharpMajor = chromaOf({ 6: 1, 10: 0.85, 1: 0.8 });
    for (let frame = 0; frame < 20; frame += 1) {
      tracker.push(cMajor, frame * 100);
    }
    tracker.estimate();
    tracker.push(fSharpMajor, 2100);
    expect(tracker.estimate()!.key).toEqual(C_MAJOR);
  });

  it("switches keys after sustained contrary input", () => {
    const tracker = new KeyTracker();
    const cMajor = chromaOf({ 0: 1, 4: 0.85, 7: 0.8 });
    const fSharpMajor = chromaOf({ 6: 1, 10: 0.85, 1: 0.8 });
    for (let frame = 0; frame < 20; frame += 1) {
      tracker.push(cMajor, frame * 100);
    }
    tracker.estimate();
    let estimate = null as ReturnType<KeyTracker["estimate"]>;
    for (let frame = 0; frame < 30; frame += 1) {
      tracker.push(fSharpMajor, 2100 + frame * 100);
      estimate = tracker.estimate();
    }
    expect(estimate!.key.tonic).toBe(6);
    expect(estimate!.key.mode).toBe("major");
  });

  it("returns null before enough evidence and after reset", () => {
    const tracker = new KeyTracker();
    expect(tracker.estimate()).toBeNull();
    tracker.push(chromaOf({ 0: 1, 4: 0.85, 7: 0.8 }), 0);
    tracker.estimate();
    tracker.reset();
    expect(tracker.estimate()).toBeNull();
  });
});
