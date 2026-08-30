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
import { KeyTracker, type KeyEstimate } from "./key.js";
import { drawSpectrum, type SpectrumTarget } from "./draw.js";
import { ChordStabilizer, PitchSmoother, choosePitch } from "./analysis-stabilizers.js";

export const FFT_SIZE = 16384;

/** Canvas targets the loop draws the spectrum into (registered by components). */
export const spectrumTargets = new Set<SpectrumTarget>();

// Display results, replaced at analysis cadence (never mutated in place).
export const pitchRef = shallowRef<PitchResult | null>(null);
export const chordRef = shallowRef<ChordResult | null>(null);
export const keyEstimateRef = shallowRef<KeyEstimate | null>(null);
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
let chromaSmooth: Float32Array<ArrayBuffer> = new Float32Array(12);
let latestChroma: Float32Array<ArrayBuffer> = new Float32Array(12);
let latestPitch: PitchResult | null = null;
let latestSpectralPitch: PitchResult | null = null;
let latestSpectralPitchAt = 0;
let displayedChord: ChordResult | null = null;
const keyTracker = new KeyTracker();
const pitchSmoother = new PitchSmoother();
const chordStabilizer = new ChordStabilizer();

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
  pitchSmoother.reset();
  chromaSmooth.fill(0);
  latestChroma.fill(0);
  latestPitch = null;
  latestSpectralPitch = null;
  latestSpectralPitchAt = 0;
  displayedChord = null;
  chordStabilizer.reset();
  keyTracker.reset();
  pitchRef.value = null;
  chordRef.value = null;
  keyEstimateRef.value = null;
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
  pitchSmoother.reset();
  chromaSmooth.fill(0);
  latestChroma.fill(0);
  latestPitch = null;
  latestSpectralPitch = null;
  displayedChord = null;
  chordStabilizer.reset();
  keyTracker.reset();
  pitchRef.value = null;
  chordRef.value = null;
  keyEstimateRef.value = null;
  chromaRef.value = null;
  levelRef.value = null;
  tickRef.value += 1;
}

function clearAfterSilence(now: number): void {
  if (now - lastSignalAt < 420) return;

  latestPitch = null;
  latestSpectralPitch = null;
  latestSpectralPitchAt = 0;
  pitchSmoother.reset();
  displayedChord = null;
  chordStabilizer.reset();

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

    keyTracker.push(latestChroma, now);
    keyEstimateRef.value = keyTracker.estimate();

    const chordCandidate = detectChord(latestChroma);
    displayedChord = chordStabilizer.stabilize(chordCandidate);
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
      latestPitch = pitchSmoother.smooth(selectedPitch, now);
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
