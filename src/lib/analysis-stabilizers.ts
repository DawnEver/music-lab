import type { ChordResult } from "./chord.js";
import type { PitchResult } from "./dsp.js";

export class PitchSmoother {
  private history: Array<{ frequency: number; confidence: number; time: number }> = [];

  reset(): void {
    this.history = [];
  }

  smooth(pitch: PitchResult, now: number): PitchResult {
    this.history = this.history.filter((item) => now - item.time < 360);
    let frequency = pitch.frequency;
    if (this.history.length >= 2) {
      const cents = this.history.map((item) => 1200 * Math.log2(item.frequency)).sort((a, b) => a - b);
      const delta = 1200 * Math.log2(frequency) - cents[Math.floor(cents.length / 2)];
      if (Math.abs(Math.abs(delta) - 1200) < 75) frequency *= delta > 0 ? 0.5 : 2;
    }
    this.history.push({ frequency, confidence: pitch.confidence, time: now });
    if (this.history.length > 7) this.history.shift();

    let weightedLog = 0;
    let weightSum = 0;
    for (const item of this.history) {
      const weight = Math.max(0.08, item.confidence);
      weightedLog += Math.log2(item.frequency) * weight;
      weightSum += weight;
    }
    return {
      frequency: Math.pow(2, weightedLog / Math.max(weightSum, 1e-9)),
      confidence: pitch.confidence,
      method: pitch.method
    };
  }
}

export function choosePitch(
  yinPitch: PitchResult | null,
  spectralPitch: PitchResult | null,
  polyphonic = false
): PitchResult | null {
  if (polyphonic && spectralPitch && spectralPitch.confidence >= 0.28) return spectralPitch;
  if (yinPitch && spectralPitch) {
    const distance = Math.abs(1200 * Math.log2(yinPitch.frequency / spectralPitch.frequency));
    const octaveResidual = Math.abs(distance - Math.round(distance / 1200) * 1200);
    if (octaveResidual < 45) return yinPitch.confidence >= 0.55 ? yinPitch : spectralPitch;
  }
  if (yinPitch && yinPitch.confidence >= 0.62) return yinPitch;
  if (spectralPitch && spectralPitch.confidence >= 0.34) return spectralPitch;
  return yinPitch || spectralPitch || null;
}

export class ChordStabilizer {
  private candidateKey = "";
  private candidateCount = 0;
  private displayed: ChordResult | null = null;

  reset(): void {
    this.candidateKey = "";
    this.candidateCount = 0;
    this.displayed = null;
  }

  stabilize(candidate: ChordResult | null): ChordResult | null {
    const key = candidate ? `${candidate.root}:${candidate.type.suffix}` : "";
    if (!candidate) {
      this.candidateCount = Math.max(0, this.candidateCount - 1);
      if (this.candidateCount === 0) this.reset();
      return this.displayed;
    }
    if (key === this.candidateKey) this.candidateCount += 1;
    else {
      this.candidateKey = key;
      this.candidateCount = 1;
    }
    if (this.candidateCount >= (candidate.confidence > 0.72 ? 2 : 3)) this.displayed = candidate;
    return this.displayed;
  }
}
