import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTE_NAMES,
  CHORD_TYPES,
  midiToFrequency,
  frequencyToMidi,
  frequencyToNote
} from "../js/music-theory.js";

test("440 Hz resolves to A4 with ~0 cents", () => {
  const note = frequencyToNote(440);
  assert.equal(note.name, "A");
  assert.equal(note.octave, 4);
  assert.equal(note.midi, 69);
  assert.ok(Math.abs(note.cents) < 0.01);
});

test("custom A4 tuning shifts the reference", () => {
  const note = frequencyToNote(442, 442);
  assert.equal(note.name, "A");
  assert.equal(note.octave, 4);
  assert.ok(Math.abs(note.cents) < 0.01);
});

test("note names and octaves across the range", () => {
  assert.equal(frequencyToNote(261.6255653005986).name, "C");
  assert.equal(frequencyToNote(261.6255653005986).octave, 4);
  assert.equal(frequencyToNote(110).name, "A");
  assert.equal(frequencyToNote(110).octave, 2);
  assert.equal(frequencyToNote(523.2511306011972).name, "C");
  assert.equal(frequencyToNote(523.2511306011972).octave, 5);
});

test("cents deviation is reported for detuned input", () => {
  const note = frequencyToNote(450);
  assert.ok(note.cents > 10, `expected sharp cents, got ${note.cents}`);
});

test("midiToFrequency and frequencyToMidi round-trip", () => {
  for (let midi = 21; midi <= 108; midi += 1) {
    const frequency = midiToFrequency(midi);
    assert.ok(Math.abs(frequencyToMidi(frequency) - midi) < 1e-9, `midi ${midi}`);
  }
});

test("chord templates are internally consistent", () => {
  assert.equal(NOTE_NAMES.length, 12);
  for (const type of CHORD_TYPES) {
    assert.equal(type.intervals.length, type.weights.length, type.suffix);
    assert.ok(type.intervals.every((i) => i >= 0 && i <= 11), type.suffix);
    assert.ok(type.weights.every((w) => w > 0 && w <= 1), type.suffix);
    assert.ok(typeof type.key === "string" && type.key.length > 0, type.suffix);
  }
});
