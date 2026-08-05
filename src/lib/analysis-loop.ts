/**
 * The real-time analysis loop (ported from the legacy app.js renderLoop).
 *
 * Owns the rAF cycle, per-frame smoothing state, and the reactivity bridge:
 *  - spectrum data is drawn imperatively to registered canvas targets and
 *    never enters Vue reactivity;
 *  - display results (pitch/chord/chroma/level) are pushed into shallowRefs
 *    at analysis cadence (~88/105 ms), not per frame;
 *  - `tickRef` bumps once per rAF when anything display-relevant changed,
 *    so larger subtrees (tuner strings panel) can sync change-only.
 */

import { shallowRef } from "vue";
import {
  clamp,
  detectPitchYin,
  analyzeSpectrum,
  type PitchRange,
  type PitchResult
} from "./dsp.js";
import { detectChord, hasPolyphonicEvidence, type ChordResult } from "./chord.js";
import { drawSpectrum, type SpectrumTarget } from "./draw.js";

export const FFT_SIZE = 16384;

/** Canvas targets the loop draws the spectrum into (registered by components). */
export const spectrumTargets = new Set<SpectrumTarget>();

// Display results, replaced at analysis cadence (never mutated in place).
export const pitchRef = shallowRef<PitchResult | null>(null);
export const chordRef = shallowRef<ChordResult | null>(null);
export const chromaRef = shallowRef<Float32Array | null>(null);
export const levelRef = shallowRef<{ rmsDb: number } | null>(null);
/** Bumped once per rAF tick that changed any display value. */
export const tickRef = shallowRef(0);

export interface AnalysisLoopParams {
  analyser: AnalyserNode;
  sampleRate: number;
  getTuning: () => number;
  getGateDb: () => number;
  getStability: () => number;
}

let animationId = 0;
let analyser: AnalyserNode | null = null;
let sampleRate = 48000;
let getTuning = () => 440;
let getGateDb = () => -52;
let getStability = () => 0.72;
let activeRange: PitchRange | null = null;

let frequencyData: Float32Array<ArrayBuffer> | null = null;
let timeData: Float32Array<ArrayBuffer> | null = null;

let lastPitchAt = 0;
let lastSpectrumAt = 0;
let lastSignalAt = 0;
let pitchHistory: Array<{ frequency: number; confidence: number; time: number }> = [];
let chromaSmooth: Float32Array<ArrayBuffer> = new Float32Array(12);
let latestChroma: Float32Array<ArrayBuffer> = new Float32Array(12);
let latestPitch: PitchResult | null = null;
let latestSpectralPitch: PitchResult | null = null;
let latestSpectralPitchAt = 0;
let lastChordCandidate = "";
let chordCandidateCount = 0;
let displayedChord: ChordResult | null = null;

/** Widens/narrows the detector band (e.g. bass B0 needs ~26 Hz). */
export function setDetectorRange(range: PitchRange | null): void {
  activeRange = range;
}

/** Start the loop over a fresh analyser, resetting all smoothing state. */
export function startAnalysisLoop(params: AnalysisLoopParams): void {
  cancelAnimationFrame(animationId);
  analyser = params.analyser;
  sampleRate = params.sampleRate;
  getTuning = params.getTuning;
  getGateDb = params.getGateDb;
  getStability = params.getStability;

  frequencyData = new Float32Array(analyser.frequencyBinCount);
  timeData = new Float32Array(analyser.fftSize);

  lastPitchAt = 0;
  lastSpectrumAt = 0;
  lastSignalAt = performance.now();
  pitchHistory = [];
  chromaSmooth.fill(0);
  latestChroma.fill(0);
  latestPitch = null;
  latestSpectralPitch = null;
  latestSpectralPitchAt = 0;
  displayedChord = null;
  lastChordCandidate = "";
  chordCandidateCount = 0;
  pitchRef.value = null;
  chordRef.value = null;
  chromaRef.value = null;
  levelRef.value = null;
  tickRef.value += 1;

  animationId = requestAnimationFrame(renderLoop);
}

/** Stop the loop and clear every display result. */
export function stopAnalysisLoop(): void {
  cancelAnimationFrame(animationId);
  animationId = 0;
  analyser = null;
  pitchHistory = [];
  chromaSmooth.fill(0);
  latestChroma.fill(0);
  latestPitch = null;
  latestSpectralPitch = null;
  displayedChord = null;
  pitchRef.value = null;
  chordRef.value = null;
  chromaRef.value = null;
  levelRef.value = null;
  tickRef.value += 1;
}

function smoothPitchCandidate(pitch: PitchResult, now: number): PitchResult {
  const history = pitchHistory.filter((item) => now - item.time < 360);
  pitchHistory = history;

  let frequency = pitch.frequency;
  if (history.length >= 2) {
    const centsValues = history
      .map((item) => 1200 * Math.log2(item.frequency))
      .sort((a, b) => a - b);
    const medianCents = centsValues[Math.floor(centsValues.length / 2)];
    const currentCents = 1200 * Math.log2(frequency);
    const delta = currentCents - medianCents;

    if (Math.abs(Math.abs(delta) - 1200) < 75) {
      frequency *= delta > 0 ? 0.5 : 2;
    }
  }

  pitchHistory.push({
    frequency,
    confidence: pitch.confidence,
    time: now
  });

  if (pitchHistory.length > 7) {
    pitchHistory.shift();
  }

  let weightedLog = 0;
  let weightSum = 0;
  for (const item of pitchHistory) {
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

function choosePitch(
  yinPitch: PitchResult | null,
  spectralPitch: PitchResult | null,
  polyphonic = false
): PitchResult | null {
  if (polyphonic && spectralPitch && spectralPitch.confidence >= 0.28) {
    return spectralPitch;
  }

  if (yinPitch && spectralPitch) {
    const distance = Math.abs(1200 * Math.log2(yinPitch.frequency / spectralPitch.frequency));
    const octaveResidual = Math.abs(distance - Math.round(distance / 1200) * 1200);

    if (octaveResidual < 45) {
      if (yinPitch.confidence >= 0.55) return yinPitch;
      return spectralPitch;
    }
  }

  if (yinPitch && yinPitch.confidence >= 0.62) return yinPitch;
  if (spectralPitch && spectralPitch.confidence >= 0.34) return spectralPitch;
  return yinPitch || spectralPitch || null;
}

function stabilizeChord(candidate: ChordResult | null): ChordResult | null {
  const key = candidate ? `${candidate.root}:${candidate.type.suffix}` : "";

  if (!candidate) {
    chordCandidateCount = Math.max(0, chordCandidateCount - 1);
    if (chordCandidateCount === 0) {
      lastChordCandidate = "";
      displayedChord = null;
    }
    return displayedChord;
  }

  if (key === lastChordCandidate) {
    chordCandidateCount += 1;
  } else {
    lastChordCandidate = key;
    chordCandidateCount = 1;
  }

  const requiredFrames = candidate.confidence > 0.72 ? 2 : 3;
  if (chordCandidateCount >= requiredFrames) {
    displayedChord = candidate;
  }

  return displayedChord;
}

function clearAfterSilence(now: number): void {
  if (now - lastSignalAt < 420) return;

  latestPitch = null;
  latestSpectralPitch = null;
  latestSpectralPitchAt = 0;
  pitchHistory = [];
  displayedChord = null;
  lastChordCandidate = "";
  chordCandidateCount = 0;

  pitchRef.value = null;
  chordRef.value = null;

  for (let i = 0; i < 12; i += 1) {
    chromaSmooth[i] *= 0.78;
    latestChroma[i] = chromaSmooth[i];
  }
  chromaRef.value = latestChroma.slice();
}

function renderLoop(now: number): void {
  if (!analyser || !frequencyData || !timeData) return;

  analyser.getFloatFrequencyData(frequencyData);
  for (const target of spectrumTargets) {
    drawSpectrum(frequencyData, {
      ...target,
      sampleRate,
      latestPitch,
      fftSize: FFT_SIZE,
      tuning: getTuning()
    });
  }

  let yinResult: ReturnType<typeof detectPitchYin> | null = null;
  if (now - lastPitchAt >= 88) {
    lastPitchAt = now;
    analyser.getFloatTimeDomainData(timeData);
    yinResult = detectPitchYin(timeData, sampleRate, getGateDb(), activeRange ?? undefined);
    levelRef.value = { rmsDb: yinResult.rmsDb };

    if (yinResult.rmsDb >= getGateDb()) {
      lastSignalAt = now;
    }
  }

  let spectralResult: ReturnType<typeof analyzeSpectrum> | null = null;
  if (now - lastSpectrumAt >= 105) {
    lastSpectrumAt = now;
    spectralResult = analyzeSpectrum(frequencyData, sampleRate, analyser.fftSize, {
      tuning: getTuning(),
      gateDb: getGateDb(),
      range: activeRange ?? undefined
    });
    latestSpectralPitch = spectralResult.dominantPitch;
    latestSpectralPitchAt = now;

    const chromaAlpha = clamp(getStability(), 0.2, 0.92);
    for (let i = 0; i < 12; i += 1) {
      chromaSmooth[i] = chromaSmooth[i] * chromaAlpha + spectralResult.chroma[i] * (1 - chromaAlpha);
      latestChroma[i] = chromaSmooth[i];
    }
    chromaRef.value = latestChroma.slice();

    const chordCandidate = detectChord(latestChroma);
    displayedChord = stabilizeChord(chordCandidate);
    chordRef.value = displayedChord;
  }

  if (yinResult || spectralResult) {
    const recentSpectralPitch = spectralResult
      ? spectralResult.dominantPitch
      : now - latestSpectralPitchAt < 280
        ? latestSpectralPitch
        : null;
    const polyphonic = Boolean(displayedChord) || hasPolyphonicEvidence(latestChroma);
    const selectedPitch = choosePitch(
      yinResult ? yinResult.pitch : null,
      recentSpectralPitch,
      polyphonic
    );

    if (selectedPitch) {
      lastSignalAt = now;
      latestPitch = smoothPitchCandidate(selectedPitch, now);
    } else {
      clearAfterSilence(now);
    }
  } else {
    clearAfterSilence(now);
  }

  pitchRef.value = latestPitch;
  tickRef.value += 1;

  animationId = requestAnimationFrame(renderLoop);
}
