import { describe, expect, it } from "vitest";
import { detectPitchYin, analyzeSpectrum } from "../src/lib/dsp.js";
import { frequencyToNote } from "../src/lib/music-theory.js";
import { SAMPLE_RATE, GATE_DB, sineWave, cMajorSpectrum } from "./helpers.js";

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
});
