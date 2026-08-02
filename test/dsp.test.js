import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPitchYin, analyzeSpectrum } from "../js/dsp.js";
import { frequencyToNote } from "../js/music-theory.js";

const SAMPLE_RATE = 48000;
const GATE_DB = -52;

/** Generate N samples of a sine at the given frequency. */
function sineWave(frequency, sampleRate, count, amplitude = 0.5) {
  const buffer = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

test("YIN detects a 440 Hz tone", () => {
  const result = detectPitchYin(sineWave(440, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
  assert.ok(result.pitch, "expected a pitch");
  assert.ok(Math.abs(result.pitch.frequency - 440) < 2, `got ${result.pitch.frequency}`);
  assert.ok(result.rmsDb > GATE_DB, "RMS should pass the gate");
});

test("YIN detects a 240 Hz tone (exact period)", () => {
  const result = detectPitchYin(sineWave(240, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
  assert.ok(result.pitch, "expected a pitch");
  assert.ok(Math.abs(result.pitch.frequency - 240) < 1, `got ${result.pitch.frequency}`);
});

test("YIN detects a high 880 Hz tone", () => {
  const result = detectPitchYin(sineWave(880, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
  assert.ok(result.pitch, "expected a pitch");
  assert.ok(Math.abs(result.pitch.frequency - 880) < 2, `got ${result.pitch.frequency}`);
});

test("YIN returns null below the noise gate", () => {
  const silence = new Float32Array(48000);
  const result = detectPitchYin(silence, SAMPLE_RATE, GATE_DB);
  assert.equal(result.pitch, null);
});

/**
 * Build a synthetic frequency-domain spectrum (dB per FFT bin) with clean
 * peaks for a C major chord: C4, E4, G4.
 */
function cMajorSpectrum(fftSize) {
  const bins = fftSize / 2;
  const data = new Float32Array(bins).fill(-100);
  const binHz = SAMPLE_RATE / fftSize;
  const peaks = [
    { frequency: 261.625565, db: -12 }, // C4
    { frequency: 329.627557, db: -16 }, // E4
    { frequency: 391.995436, db: -20 } //  G4
  ];
  for (const { frequency, db } of peaks) {
    const index = Math.min(bins - 2, Math.max(1, Math.round(frequency / binHz)));
    data[index] = db;
  }
  return data;
}

test("analyzeSpectrum finds C4 as the dominant pitch of a C major spectrum", () => {
  const fftSize = 16384;
  const data = cMajorSpectrum(fftSize);
  const result = analyzeSpectrum(data, SAMPLE_RATE, fftSize, { tuning: 440, gateDb: GATE_DB });

  assert.ok(result.dominantPitch, "expected a dominant pitch");
  const note = frequencyToNote(result.dominantPitch.frequency);
  assert.equal(note.name, "C", `expected C, got ${note.name}`);
  assert.equal(note.octave, 4, `expected octave 4, got ${note.octave}`);
  assert.ok(Math.abs(result.dominantPitch.frequency - 261.63) < 2, `got ${result.dominantPitch.frequency}`);
  assert.ok(result.dominantPitch.confidence > 0.5, "confidence too low");

  // Chroma should carry the C major tones, with the root strongest.
  assert.ok(result.chroma[0] > 0.3, "root C should dominate");
  assert.ok(result.chroma[4] > 0.2, "third E present");
  assert.ok(result.chroma[7] > 0.1, "fifth G present");
});

test("analyzeSpectrum returns silence when everything is below the gate", () => {
  const fftSize = 16384;
  const data = new Float32Array(fftSize / 2).fill(-100);
  const result = analyzeSpectrum(data, SAMPLE_RATE, fftSize, { tuning: 440, gateDb: GATE_DB });
  assert.equal(result.dominantPitch, null);
  assert.ok([...result.chroma].every((v) => v === 0), "chroma should be empty");
});
