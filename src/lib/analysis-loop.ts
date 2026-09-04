/**
 * Browser adapter for the analysis pipeline.
 *
 * This module owns only the things that need a browser: the rAF cycle, the
 * AnalyserNode reads, the imperative spectrum draw, and the bridge into Vue
 * reactivity. All analysis decisions live in AnalysisPipeline.
 *
 *  - spectrum data is drawn imperatively to registered canvas targets and
 *    never enters Vue reactivity;
 *  - display results (pitch/chord/chroma/level) are pushed into shallowRefs
 *    at analysis cadence;
 *  - `tickRef` bumps once per rAF, so larger subtrees (the strings panel)
 *    can sync change-only.
 */

import { shallowRef } from "vue";
import type { PitchRange, PitchResult } from "./dsp.js";
import type { ChordResult } from "./chord.js";
import type { KeyEstimate } from "./key.js";
import { drawSpectrum, type SpectrumTarget } from "./plot/spectrum.js";
import { AnalysisPipeline, type AnalysisSnapshot } from "./analysis-pipeline.js";

export const FFT_SIZE = 16384;
export { PITCH_INTERVAL_MS, SPECTRUM_INTERVAL_MS } from "./analysis-pipeline.js";

/** Canvas targets the loop draws the spectrum into (registered by components). */
export const spectrumTargets = new Set<SpectrumTarget>();

// Display results, replaced at analysis cadence (never mutated in place).
export const pitchRef = shallowRef<PitchResult | null>(null);
export const chordRef = shallowRef<ChordResult | null>(null);
export const keyEstimateRef = shallowRef<KeyEstimate | null>(null);
export const chromaRef = shallowRef<Float32Array | null>(null);
export const levelRef = shallowRef<{ rmsDb: number } | null>(null);
/** Bumped once per rAF tick. */
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
let pipeline: AnalysisPipeline | null = null;
let pendingRange: PitchRange | null = null;
let sampleRate = 48000;
let getTuning = () => 440;
let getGateDb = () => -52;
let getStability = () => 0.72;

let frequencyData: Float32Array<ArrayBuffer> | null = null;
let timeData: Float32Array<ArrayBuffer> | null = null;

/** Widens/narrows the detector band (e.g. bass B0 needs ~26 Hz). */
export function setDetectorRange(range: PitchRange | null): void {
  pendingRange = range;
  pipeline?.setRange(range);
}

function publish(snapshot: AnalysisSnapshot): void {
  pitchRef.value = snapshot.pitch;
  chordRef.value = snapshot.chord;
  keyEstimateRef.value = snapshot.keyEstimate;
  chromaRef.value = snapshot.chroma;
  levelRef.value = snapshot.level;
  tickRef.value += 1;
}

/** Start the loop over a fresh analyser, resetting all analysis state. */
export function startAnalysisLoop(params: AnalysisLoopParams): void {
  cancelAnimationFrame(animationId);
  analyser = params.analyser;
  sampleRate = params.sampleRate;
  getTuning = params.getTuning;
  getGateDb = params.getGateDb;
  getStability = params.getStability;

  frequencyData = new Float32Array(analyser.frequencyBinCount);
  timeData = new Float32Array(analyser.fftSize);

  pipeline = new AnalysisPipeline({ sampleRate, fftSize: FFT_SIZE });
  pipeline.setRange(pendingRange);
  publish(pipeline.snapshot());

  animationId = requestAnimationFrame(renderLoop);
}

/** Stop the loop and clear every display result. */
export function stopAnalysisLoop(): void {
  cancelAnimationFrame(animationId);
  animationId = 0;
  analyser = null;
  pipeline?.reset();
  pipeline = null;
  publish({ pitch: null, chord: null, keyEstimate: null, chroma: null, level: null, spectralRan: false });
}

function renderLoop(now: number): void {
  if (!analyser || !pipeline || !frequencyData || !timeData) return;

  analyser.getFloatFrequencyData(frequencyData);
  const currentPitch = pitchRef.value;
  for (const target of spectrumTargets) {
    drawSpectrum(frequencyData, {
      ...target,
      sampleRate,
      latestPitch: currentPitch,
      fftSize: FFT_SIZE,
      tuning: getTuning()
    });
  }

  const analyserNode = analyser;
  const buffer = timeData;
  publish(
    pipeline.push({
      now,
      frequencyData,
      readTimeData: () => {
        analyserNode.getFloatTimeDomainData(buffer);
        return buffer;
      },
      tuning: getTuning(),
      gateDb: getGateDb(),
      stability: getStability()
    })
  );

  animationId = requestAnimationFrame(renderLoop);
}
