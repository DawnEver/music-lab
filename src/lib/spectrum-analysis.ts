import { midiToFrequency, frequencyToMidi } from "./music-theory.js";
import { clamp, smoothstep, resolveRange, type PitchRange } from "./dsp-core.js";
import type { PitchResult } from "./pitch-detection.js";
export interface PeakSample {
  db: number;
  index: number;
}
export function samplePeakDb(
  data: Float32Array,
  frequency: number,
  sampleRate: number,
  fftSize: number,
  centsRadius = 26
): PeakSample {
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= sampleRate / 2) {
    return { db: -160, index: 0 };
  }

  const binHz = sampleRate / fftSize;
  const center = frequency / binHz;
  const factor = Math.pow(2, centsRadius / 1200) - 1;
  const radius = Math.max(1, Math.ceil(center * factor));
  const start = Math.max(1, Math.floor(center - radius));
  const end = Math.min(data.length - 2, Math.ceil(center + radius));

  let bestDb = -160;
  let bestIndex = Math.round(center);

  for (let i = start; i <= end; i += 1) {
    const value = Number.isFinite(data[i]) ? data[i] : -160;
    if (value > bestDb) {
      bestDb = value;
      bestIndex = i;
    }
  }

  return { db: bestDb, index: bestIndex };
}

export function refinePeakFrequency(data: Float32Array, index: number, sampleRate: number, fftSize: number): number {
  if (index <= 0 || index >= data.length - 1) {
    return (index * sampleRate) / fftSize;
  }

  const left = Number.isFinite(data[index - 1]) ? data[index - 1] : -160;
  const center = Number.isFinite(data[index]) ? data[index] : -160;
  const right = Number.isFinite(data[index + 1]) ? data[index + 1] : -160;
  const denominator = left - 2 * center + right;
  let shift = 0;

  if (Math.abs(denominator) > 1e-9) {
    shift = clamp((0.5 * (left - right)) / denominator, -1, 1);
  }

  return ((index + shift) * sampleRate) / fftSize;
}
export function percentile(values: number[], p: number): number {
  if (!values.length) return -100;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[index];
}

/**
 * Build a 12-bin chroma vector from spectrum peaks. Peaks that are likely
 * sub-harmonics of a lower partial are down-weighted (independence factor).
 * `range` widens the sampled band for low/high-pitched instruments.
 */
export function buildChromaFromPeaks(
  data: Float32Array,
  sampleRate: number,
  fftSize: number,
  maxDb: number,
  noiseFloor: number,
  tuning = 440,
  range?: PitchRange
): Float32Array {
  const { minHz, maxHz } = resolveRange(range, tuning);
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;
  const minBin = Math.max(2, Math.floor(minHz / binHz));
  const maxFrequency = Math.min(Math.max(1800, maxHz), sampleRate / 2 - 20);
  const maxBin = Math.min(data.length - 2, Math.ceil(maxFrequency / binHz));
  const threshold = Math.max(noiseFloor + 7, maxDb - 48);

  const relativeAmplitude = (db: number): number => {
    if (!Number.isFinite(db)) return 0;
    return Math.pow(10, (db - maxDb) / 20);
  };

  for (let i = minBin; i <= maxBin; i += 1) {
    const db = Number.isFinite(data[i]) ? data[i] : -160;
    const left = Number.isFinite(data[i - 1]) ? data[i - 1] : -160;
    const right = Number.isFinite(data[i + 1]) ? data[i + 1] : -160;

    if (db < threshold || db < left || db < right) continue;

    const frequency = refinePeakFrequency(data, i, sampleRate, fftSize);
    const midiFloat = frequencyToMidi(frequency, tuning);
    const midi = Math.round(midiFloat);
    const cents = 100 * (midiFloat - midi);
    if (Math.abs(cents) > 42) continue;

    const amplitude = relativeAmplitude(db);
    const lowFrequencyBias = Math.min(1, Math.pow(300 / frequency, 0.8));
    const tuningWeight = Math.exp(-0.5 * Math.pow(cents / 27, 2));

    let subharmonicSupport = 0;
    const divisors = [2, 3, 4, 5];
    const weights = [0.85, 0.65, 0.5, 0.4];

    for (let j = 0; j < divisors.length; j += 1) {
      const lowerFrequency = frequency / divisors[j];
      if (lowerFrequency < minHz) continue;
      const lowerPeak = samplePeakDb(data, lowerFrequency, sampleRate, fftSize, 30);
      subharmonicSupport = Math.max(
        subharmonicSupport,
        relativeAmplitude(lowerPeak.db) * weights[j]
      );
    }

    const independence = Math.max(0.12, 1 - 0.8 * subharmonicSupport);
    const pitchClass = ((midi % 12) + 12) % 12;
    chroma[pitchClass] += amplitude * lowFrequencyBias * tuningWeight * independence;
  }

  const background = percentile(Array.from(chroma), 0.25) * 0.5;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    chroma[i] = Math.max(0, chroma[i] - background);
    sum += chroma[i];
  }

  if (sum > 1e-9) {
    for (let i = 0; i < 12; i += 1) chroma[i] /= sum;
  }

  return chroma;
}

export interface SpectrumConfig {
  tuning?: number;
  gateDb?: number;
  range?: PitchRange;
}

export interface SpectralCandidate {
  midi: number;
  pitchClass: number;
  f0: number;
  frequency: number;
  score: number;
  presence: number;
  fundamentalDb: number;
}

export interface SpectrumAnalysisResult {
  chroma: Float32Array;
  dominantPitch: PitchResult | null;
  maxDb: number;
  noiseFloor: number;
}

/**
 * Analyze a spectrum (analyser.getFloatFrequencyData output): score every
 * semitone's fundamental + harmonics, return the dominant pitch and chroma.
 * Config defaults keep the exported API usable without arguments.
 */
export function analyzeSpectrum(
  data: Float32Array,
  sampleRate: number,
  fftSize: number,
  config: SpectrumConfig = {}
): SpectrumAnalysisResult {
  const { tuning = 440, gateDb = -52, range } = config;
  const { minHz, maxHz, minMidi, maxMidi } = resolveRange(range, tuning);
  const binHz = sampleRate / fftSize;
  // Scan floor derived from the range (a hardcoded 48 Hz floor would hide
  // low fundamentals like bass B0 at ~31 Hz).
  const minBin = Math.max(1, Math.floor(midiToFrequency(minMidi, tuning) / binHz));
  const maxBin = Math.min(data.length - 2, Math.ceil(Math.min(5200, sampleRate / 2 - binHz) / binHz));
  const samples: number[] = [];
  let maxDb = -160;
  const step = Math.max(1, Math.floor((maxBin - minBin) / 220));

  for (let i = minBin; i <= maxBin; i += 1) {
    const db = Number.isFinite(data[i]) ? data[i] : -160;
    if (db > maxDb) maxDb = db;
    if ((i - minBin) % step === 0) samples.push(db);
  }

  const noiseFloor = percentile(samples, 0.52);
  const dynamicRange = Math.max(10, maxDb - noiseFloor);

  if (maxDb < gateDb - 6) {
    return {
      chroma: new Float32Array(12),
      dominantPitch: null,
      maxDb,
      noiseFloor
    };
  }

  const candidates: SpectralCandidate[] = [];

  const relativeAmplitude = (db: number): number => {
    if (!Number.isFinite(db)) return 0;
    return Math.pow(10, (db - maxDb) / 20);
  };

  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    const f0 = midiToFrequency(midi, tuning);
    if (f0 < minHz || f0 > Math.min(maxHz, sampleRate / 2 - 40)) continue;

    const fundamental = samplePeakDb(data, f0, sampleRate, fftSize, 32);
    const fundRel = relativeAmplitude(fundamental.db);
    const presence = smoothstep(
      noiseFloor + 4,
      noiseFloor + Math.min(24, Math.max(10, dynamicRange * 0.78)),
      fundamental.db
    );

    let harmonicScore = 0;
    const harmonicWeights = [0, 0, 0.58, 0.42, 0.33, 0.27, 0.22, 0.18, 0.15];

    for (let harmonic = 2; harmonic <= 8; harmonic += 1) {
      const frequency = f0 * harmonic;
      if (frequency >= Math.min(5200, sampleRate / 2 - 20)) break;
      const harmonicPeak = samplePeakDb(data, frequency, sampleRate, fftSize, 30);
      harmonicScore += relativeAmplitude(harmonicPeak.db) * harmonicWeights[harmonic];
    }

    let subharmonicPenalty = 0;
    const divisors = [2, 3, 4, 5];
    const divisorWeights = [0.85, 0.68, 0.56, 0.48];

    for (let j = 0; j < divisors.length; j += 1) {
      const lowerFrequency = f0 / divisors[j];
      if (lowerFrequency < minHz) continue;
      const lowerPeak = samplePeakDb(data, lowerFrequency, sampleRate, fftSize, 28);
      subharmonicPenalty = Math.max(
        subharmonicPenalty,
        relativeAmplitude(lowerPeak.db) * divisorWeights[j]
      );
    }

    const octaveWeight = 1 / Math.pow(Math.max(1, f0 / 220), 0.55);
    const harmonicIndependence = Math.pow(
      Math.max(0.12, 1 - 0.92 * clamp(subharmonicPenalty, 0, 0.96)),
      1.2
    );
    const score =
      (1.62 * fundRel + harmonicScore) *
      (0.03 + 0.97 * presence) *
      harmonicIndependence *
      octaveWeight;

    const pitchClass = ((midi % 12) + 12) % 12;
    const candidate: SpectralCandidate = {
      midi,
      pitchClass,
      f0,
      frequency: refinePeakFrequency(data, fundamental.index, sampleRate, fftSize),
      score,
      presence,
      fundamentalDb: fundamental.db
    };

    candidates.push(candidate);
  }

  const chroma = buildChromaFromPeaks(data, sampleRate, fftSize, maxDb, noiseFloor, tuning, range);

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] || null;
  let second: SpectralCandidate | null = null;

  if (best) {
    second = candidates.find((candidate) => candidate.pitchClass !== best.pitchClass) || candidates[1] || null;
  }

  let dominantPitch: PitchResult | null = null;
  if (best && best.score > 0.08 && maxDb > gateDb - 8) {
    const contrast = second ? clamp((best.score - second.score) / Math.max(best.score, 1e-6), 0, 1) : 1;
    const confidence = clamp(0.24 + 0.48 * best.presence + 0.55 * contrast, 0, 1);
    dominantPitch = {
      frequency: best.frequency,
      confidence,
      method: "spectral"
    };
  }

  return {
    chroma,
    dominantPitch,
    maxDb,
    noiseFloor
  };
}
