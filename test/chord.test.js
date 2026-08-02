import { test } from "node:test";
import assert from "node:assert/strict";
import { detectChord, hasPolyphonicEvidence } from "../js/chord.js";

/**
 * Build a chroma vector whose strongest bins are the given pitch classes,
 * with a gentle rolloff so the root is the loudest.
 */
function chromaFor(tones, peak = 1) {
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

test("recognizes C major", () => {
  const chord = detectChord(chromaFor(C_MAJOR));
  assert.ok(chord, "expected a chord match");
  assert.equal(chord.symbol, "C");
  assert.equal(chord.root, 0);
  assert.ok(chord.confidence > 0);
});

test("recognizes A minor", () => {
  const chord = detectChord(chromaFor(A_MINOR));
  assert.ok(chord, "expected a chord match");
  assert.equal(chord.symbol, "Am");
  assert.equal(chord.root, 9);
  assert.ok(chord.confidence > 0);
});

test("recognizes G dominant seventh", () => {
  const chord = detectChord(chromaFor(G7, 0.9));
  assert.ok(chord, "expected a chord match");
  assert.equal(chord.symbol, "G7");
  assert.equal(chord.root, 7);
  assert.ok(chord.confidence > 0);
});

test("rejects a single-tone chroma", () => {
  const chroma = new Float32Array(12);
  chroma[0] = 1;
  assert.equal(detectChord(chroma), null);
});

test("rejects silence", () => {
  assert.equal(detectChord(new Float32Array(12)), null);
});

test("polyphonic evidence", () => {
  assert.equal(hasPolyphonicEvidence(chromaFor([0])), false);
  assert.equal(hasPolyphonicEvidence(chromaFor(C_MAJOR)), true);
  assert.equal(hasPolyphonicEvidence(new Float32Array(12)), false);
});
