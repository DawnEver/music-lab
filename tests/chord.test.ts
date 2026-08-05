import { describe, expect, it } from "vitest";
import { detectChord, hasPolyphonicEvidence } from "../src/lib/chord.js";

/**
 * Build a chroma vector whose strongest bins are the given pitch classes,
 * with a gentle rolloff so the root is the loudest.
 */
function chromaFor(tones: number[], peak = 1): Float32Array {
  const chroma = new Float32Array(12);
  tones.forEach((pitchClass, index) => {
    chroma[pitchClass] = peak * (1 - index * 0.12);
  });
  return chroma;
}

// Pitch-class sets for the reference chords.
const C_MAJOR = [0, 4, 7]; // C  E  G
const A_MINOR = [9, 0, 4]; // A  C  E
const G7 = [7, 11, 2, 5]; //  G  B  D  F

describe("detectChord", () => {
  it("recognizes C major", () => {
    const chord = detectChord(chromaFor(C_MAJOR));
    expect(chord).toBeTruthy();
    expect(chord!.symbol).toBe("C");
    expect(chord!.root).toBe(0);
    expect(chord!.descriptionKey).toBe("major");
    expect(chord!.confidence).toBeGreaterThan(0);
  });

  it("recognizes A minor", () => {
    const chord = detectChord(chromaFor(A_MINOR));
    expect(chord).toBeTruthy();
    expect(chord!.symbol).toBe("Am");
    expect(chord!.root).toBe(9);
    expect(chord!.descriptionKey).toBe("minor");
    expect(chord!.confidence).toBeGreaterThan(0);
  });

  it("recognizes G dominant seventh", () => {
    const chord = detectChord(chromaFor(G7, 0.9));
    expect(chord).toBeTruthy();
    expect(chord!.symbol).toBe("G7");
    expect(chord!.root).toBe(7);
    expect(chord!.descriptionKey).toBe("dom7");
    expect(chord!.confidence).toBeGreaterThan(0);
  });

  it("rejects a single-tone chroma", () => {
    const chroma = new Float32Array(12);
    chroma[0] = 1;
    expect(detectChord(chroma)).toBeNull();
  });

  it("rejects silence", () => {
    expect(detectChord(new Float32Array(12))).toBeNull();
  });
});

describe("hasPolyphonicEvidence", () => {
  it("distinguishes polyphony from single tones", () => {
    expect(hasPolyphonicEvidence(chromaFor([0]))).toBe(false);
    expect(hasPolyphonicEvidence(chromaFor(C_MAJOR))).toBe(true);
    expect(hasPolyphonicEvidence(new Float32Array(12))).toBe(false);
  });
});
