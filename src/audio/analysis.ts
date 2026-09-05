/**
 * The analysis stream: frames from the live input, features out.
 *
 * One input means one analysis, so this is a single stream — but it is a
 * stream with subscribers, not a pile of module globals that only the tuner
 * could reach. Views take what they need:
 *
 *  - display results (pitch/chord/chroma/level) are shallowRefs replaced at
 *    analysis cadence, so Vue re-renders only when a value changes;
 *  - `onFrame` hands the raw spectrum to imperative renderers, which keeps
 *    canvas drawing out of Vue reactivity entirely;
 *  - `tickRef` bumps once per frame, so large subtrees can sync
 *    change-only.
 *
 * Time comes from the audio clock, never from rAF: the spectrogram, the
 * metronome and a sung note have to land on one timeline for any of them to
 * be drawn together.
 */

import { reactive, shallowRef } from "vue";
import type { PitchRange, PitchResult } from "../lib/dsp.js";
import type { ChordResult } from "../lib/chord.js";
import type { KeyEstimate } from "../lib/key.js";
import { AnalysisPipeline, type AnalysisSnapshot } from "../lib/analysis-pipeline.js";
import { clamp } from "../lib/dsp-core.js";
import { storedJson } from "../lib/persist.js";
import { createCapture, type Capture } from "./capture.js";
import { audioContext } from "./source.js";

/** Long window: fine in frequency, which is what tuning needs. */
export const FFT_SIZE = 16384;
export { PITCH_INTERVAL_MS, SPECTRUM_INTERVAL_MS } from "../lib/analysis-pipeline.js";

export interface AnalysisSettings {
  tuning: number;
  gateDb: number;
  /** Analyser smoothing; also the chroma smoothing factor. */
  stability: number;
}

function defaultSettings(): AnalysisSettings {
  return { tuning: 440, gateDb: -52, stability: 0.72 };
}

/**
 * Analysis knobs the settings panel edits. A4 in particular is a property
 * of the ensemble the player is in, not of a session — asking for it again
 * every visit is asking the same question twice.
 */
export const analysisSettings = reactive<AnalysisSettings>(defaultSettings());

const storedSettings = storedJson<AnalysisSettings>("analysis", defaultSettings, (raw, base) => {
  const value = (raw ?? {}) as Partial<AnalysisSettings>;
  return {
    tuning: inRange(value.tuning, 390, 500) ?? base.tuning,
    gateDb: inRange(value.gateDb, -90, -20) ?? base.gateDb,
    stability: inRange(value.stability, 0.2, 0.92) ?? base.stability
  };
});

function inRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/** Read persisted knobs; a view that shows them calls this once. */
export function hydrateAnalysisSettings(): void {
  Object.assign(analysisSettings, storedSettings.read());
  capture?.setSmoothing(clamp(analysisSettings.stability, 0.2, 0.92));
}

export function persistAnalysisSettings(): void {
  storedSettings.write({ ...analysisSettings });
}

// Display results, replaced at analysis cadence (never mutated in place).
export const pitchRef = shallowRef<PitchResult | null>(null);
/**
 * The pitch as detected, unsmoothed. The needle reads `pitchRef`; anything
 * plotting or judging a moment in time reads this one.
 */
export const rawPitchRef = shallowRef<PitchResult | null>(null);
export const chordRef = shallowRef<ChordResult | null>(null);
export const keyEstimateRef = shallowRef<KeyEstimate | null>(null);
export const chromaRef = shallowRef<Float32Array | null>(null);
export const levelRef = shallowRef<{ rmsDb: number } | null>(null);
/** Bumped once per frame. */
export const tickRef = shallowRef(0);

/** One frame of raw spectrum, for renderers that draw outside Vue. */
export interface AnalysisFrameView {
  frequencyData: Float32Array;
  sampleRate: number;
  fftSize: number;
  /** Audio-clock seconds. */
  time: number;
  pitch: PitchResult | null;
  tuning: number;
}

const frameListeners = new Set<(frame: AnalysisFrameView) => void>();

/** Subscribe an imperative renderer to every frame. Returns an unsubscribe. */
export function onFrame(listener: (frame: AnalysisFrameView) => void): () => void {
  frameListeners.add(listener);
  return () => frameListeners.delete(listener);
}

let animationId = 0;
let capture: Capture | null = null;
let pipeline: AnalysisPipeline | null = null;
let pendingRange: PitchRange | null = null;
let frequencyData: Float32Array<ArrayBuffer> | null = null;
let timeData: Float32Array<ArrayBuffer> | null = null;

/** Widens/narrows the detector band (e.g. bass B0 needs ~26 Hz). */
export function setDetectorRange(range: PitchRange | null): void {
  pendingRange = range;
  pipeline?.setRange(range);
}

/** Apply the stability setting to the live capture and the pipeline. */
export function applyStability(value: number): void {
  analysisSettings.stability = value;
  capture?.setSmoothing(clamp(value, 0.2, 0.92));
  persistAnalysisSettings();
}

function publish(snapshot: AnalysisSnapshot): void {
  pitchRef.value = snapshot.pitch;
  rawPitchRef.value = snapshot.rawPitch ?? null;
  chordRef.value = snapshot.chord;
  keyEstimateRef.value = snapshot.keyEstimate;
  chromaRef.value = snapshot.chroma;
  levelRef.value = snapshot.level;
  tickRef.value += 1;
}

/** Start analysing the live input, resetting all analysis state. */
export function startAnalysis(): void {
  stopAnalysis();
  capture = createCapture({
    fftSize: FFT_SIZE,
    smoothing: clamp(analysisSettings.stability, 0.2, 0.92)
  });

  const sampleRate = capture.sampleRate();
  frequencyData = new Float32Array(FFT_SIZE / 2);
  timeData = new Float32Array(FFT_SIZE);
  pipeline = new AnalysisPipeline({ sampleRate, fftSize: FFT_SIZE });
  pipeline.setRange(pendingRange);
  publish(pipeline.snapshot());

  animationId = requestAnimationFrame(renderLoop);
}

/** Stop the stream and clear every display result. */
export function stopAnalysis(): void {
  cancelAnimationFrame(animationId);
  animationId = 0;
  capture?.dispose();
  capture = null;
  pipeline?.reset();
  pipeline = null;
  publish({
    pitch: null,
    chord: null,
    keyEstimate: null,
    chroma: null,
    level: null,
    spectralRan: false
  });
}

function renderLoop(): void {
  const analyser = capture?.analyser();
  const context = audioContext();
  if (!analyser || !pipeline || !frequencyData || !timeData || !context) {
    if (animationId) animationId = requestAnimationFrame(renderLoop);
    return;
  }

  const time = context.currentTime;
  analyser.getFloatFrequencyData(frequencyData);

  if (frameListeners.size) {
    const view: AnalysisFrameView = {
      frequencyData,
      sampleRate: context.sampleRate,
      fftSize: FFT_SIZE,
      time,
      pitch: pitchRef.value,
      tuning: analysisSettings.tuning
    };
    for (const listener of frameListeners) listener(view);
  }

  const buffer = timeData;
  publish(
    pipeline.push({
      nowMs: time * 1000,
      frequencyData,
      readTimeData: () => {
        analyser.getFloatTimeDomainData(buffer);
        return buffer;
      },
      tuning: analysisSettings.tuning,
      gateDb: analysisSettings.gateDb,
      stability: analysisSettings.stability
    })
  );

  animationId = requestAnimationFrame(renderLoop);
}
