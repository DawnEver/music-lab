import { describe, expect, it } from "vitest";
import { detectPitchYin, analyzeSpectrum } from "../src/lib/dsp.js";
import { frequencyToNote } from "../src/lib/music-theory.js";
import { SAMPLE_RATE, GATE_DB, sineWave, cMajorSpectrum } from "./helpers.js";

/**
 * Spectrum with a fundamental and a few harmonics, like a real string.
 * Energy is spread linearly across the two bins around each partial's
 * fractional position, so the parabolic refinement lands on the true
 * frequency (at 30 Hz one bin spans ~160 cents — a single-bin peak would
 * read the bin center instead).
 */
function harmonicSpectrum(fftSize: number, fundamental: number): Float32Array {
  const data = new Float32Array(fftSize / 2).fill(-100);
  const binHz = SAMPLE_RATE / fftSize;
  for (let harmonic = 1; harmonic <= 3; harmonic += 1) {
    const fractional = (fundamental * harmonic) / binHz;
    const lo = Math.max(1, Math.floor(fractional));
    const weight = fractional - lo;
    const db = -12 - 6 * (harmonic - 1);
    data[lo] = db + 20 * Math.log10(1 - weight || 1e-6);
    if (lo + 1 < data.length) data[lo + 1] = db + 20 * Math.log10(weight || 1e-6);
  }
  return data;
}

describe("detectPitchYin", () => {
  it("detects a 440 Hz tone", () => {
    const result = detectPitchYin(sineWave(440, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
    expect(result.pitch).toBeTruthy();
    expect(Math.abs(result.pitch!.frequency - 440)).toBeLessThan(2);
    expect(result.rmsDb).toBeGreaterThan(GATE_DB);
  });

  it("detects a 240 Hz tone (exact period)", () => {
    const result = detectPitchYin(sineWave(240, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
    expect(result.pitch).toBeTruthy();
    expect(Math.abs(result.pitch!.frequency - 240)).toBeLessThan(1);
  });

  it("detects a high 880 Hz tone", () => {
    const result = detectPitchYin(sineWave(880, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB);
    expect(result.pitch).toBeTruthy();
    expect(Math.abs(result.pitch!.frequency - 880)).toBeLessThan(2);
  });

  it("returns null below the noise gate", () => {
    const silence = new Float32Array(48000);
    const result = detectPitchYin(silence, SAMPLE_RATE, GATE_DB);
    expect(result.pitch).toBeNull();
  });

  it("detects a low 30.87 Hz tone (bass B0) when the range is widened", () => {
    const result = detectPitchYin(sineWave(30.87, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB, {
      minHz: 26,
      maxHz: 400
    });
    expect(result.pitch).toBeTruthy();
    expect(Math.abs(result.pitch!.frequency - 30.87)).toBeLessThan(1.5);
  });

  it("detects high tones (D6, A6) when the range is widened", () => {
    const d6 = detectPitchYin(sineWave(1174.66, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB, {
      maxHz: 1900
    });
    expect(d6.pitch).toBeTruthy();
    expect(Math.abs(d6.pitch!.frequency - 1174.66)).toBeLessThan(2);

    const a6 = detectPitchYin(sineWave(1760, SAMPLE_RATE, 48000), SAMPLE_RATE, GATE_DB, {
      maxHz: 1900
    });
    expect(a6.pitch).toBeTruthy();
    expect(Math.abs(a6.pitch!.frequency - 1760)).toBeLessThan(2);
  });
});

describe("analyzeSpectrum", () => {
  it("finds C4 as the dominant pitch of a C major spectrum", () => {
    const fftSize = 16384;
    const data = cMajorSpectrum(fftSize);
    const result = analyzeSpectrum(data, SAMPLE_RATE, fftSize, { tuning: 440, gateDb: GATE_DB });

    expect(result.dominantPitch).toBeTruthy();
    const note = frequencyToNote(result.dominantPitch!.frequency);
    expect(note.name).toBe("C");
    expect(note.octave).toBe(4);
    expect(Math.abs(result.dominantPitch!.frequency - 261.63)).toBeLessThan(2);
    expect(result.dominantPitch!.confidence).toBeGreaterThan(0.5);

    // Chroma should carry the C major tones, with the root strongest.
    expect(result.chroma[0]).toBeGreaterThan(0.3);
    expect(result.chroma[4]).toBeGreaterThan(0.2);
    expect(result.chroma[7]).toBeGreaterThan(0.1);
  });

  it("returns silence when everything is below the gate", () => {
    const fftSize = 16384;
    const data = new Float32Array(fftSize / 2).fill(-100);
    const result = analyzeSpectrum(data, SAMPLE_RATE, fftSize, { tuning: 440, gateDb: GATE_DB });
    expect(result.dominantPitch).toBeNull();
    expect([...result.chroma].every((v) => v === 0)).toBe(true);
  });

  it("finds B0 as the dominant pitch of a low harmonic spectrum with a widened range", () => {
    const fftSize = 16384;
    const data = harmonicSpectrum(fftSize, 30.87);
    const result = analyzeSpectrum(data, SAMPLE_RATE, fftSize, {
      tuning: 440,
      gateDb: GATE_DB,
      range: { minHz: 26, maxHz: 130, minMidi: 21, maxMidi: 30 }
    });

    expect(result.dominantPitch).toBeTruthy();
    const note = frequencyToNote(result.dominantPitch!.frequency);
    expect(note.name).toBe("B");
    expect(note.octave).toBe(0);
    expect(Math.abs(result.dominantPitch!.frequency - 30.87)).toBeLessThan(1.5);
  });
});

describe("pitch detection on voice-like tones", () => {
  /** A fundamental with harmonics — what a sung note actually looks like. */
  function harmonicTone(hz: number, rate: number, count: number): Float32Array {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      out[i] =
        0.5 * Math.sin((2 * Math.PI * hz * i) / rate) +
        0.2 * Math.sin((4 * Math.PI * hz * i) / rate) +
        0.1 * Math.sin((6 * Math.PI * hz * i) / rate);
    }
    return out;
  }

  it("reports the fundamental rather than half or double it", () => {
    // Octave errors are the failure mode that matters on voice: they look
    // like a leap nobody sang and they survive every later stage.
    for (const hz of [130.81, 261.63, 329.63, 440, 659.26]) {
      const result = detectPitchYin(harmonicTone(hz, 48000, 16384), 48000, -52, {
        minHz: 60,
        maxHz: 1400
      });
      expect(result.pitch?.frequency ?? 0, `${hz} Hz`).toBeCloseTo(hz, 0);
      expect(result.pitch?.confidence ?? 0).toBeGreaterThan(0.9);
    }
  });
});
