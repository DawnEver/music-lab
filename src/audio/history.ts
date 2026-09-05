/**
 * The rolling record of what has been heard: one column per capture tick,
 * stamped with audio time.
 *
 * It runs off its own tap, because the spectrogram's needs are the
 * opposite of the tuner's: a 16384-sample window smears 341 ms of sound
 * into every column, which is exactly the detail a time axis exists to
 * show. Capture is paced by the clock rather than by rAF, so the time axis
 * means the same thing on a 60 Hz and a 120 Hz display.
 */

import { reduceToLogBands, SpectrogramBuffer, SPECTROGRAM_BANDS } from "../lib/spectrogram.js";
import { createCapture, type Capture } from "./capture.js";
import { audioContext } from "./source.js";
import { rawPitchRef } from "./analysis.js";

/** Retention. The window control zooms inside this. */
export const HISTORY_SECONDS = 60;
/** Columns per second. Finer than this is invisible; coarser flickers. */
export const CAPTURE_HZ = 30;
export const HISTORY_MIN_HZ = 40;
export const HISTORY_MAX_HZ = 12000;

/** Short window: sharp in time, which is what a time axis is for. */
export type ResolutionId = "time" | "balanced" | "frequency";

const FFT_SIZES: Record<ResolutionId, number> = {
  time: 1024,
  balanced: 2048,
  frequency: 4096
};

export const historyBuffer = new SpectrogramBuffer(
  Math.ceil(HISTORY_SECONDS * CAPTURE_HZ)
);

let capture: Capture | null = null;
let frequencyData: Float32Array<ArrayBuffer> | null = null;
let animationId = 0;
let nextCaptureAt = 0;
let resolution: ResolutionId = "balanced";

function bandOptions(sampleRate: number, fftSize: number) {
  return {
    sampleRate,
    fftSize,
    minHz: HISTORY_MIN_HZ,
    maxHz: HISTORY_MAX_HZ,
    bands: SPECTROGRAM_BANDS
  };
}

/** Rebuild the tap at a new time/frequency trade-off. */
export function setHistoryResolution(id: ResolutionId): void {
  if (id === resolution) return;
  resolution = id;
  if (capture) {
    stopHistory(false);
    startHistory();
  }
}

export function historyResolution(): ResolutionId {
  return resolution;
}

export function startHistory(): void {
  if (capture) return;
  const fftSize = FFT_SIZES[resolution];
  // Smoothing is a time average: on a time axis it is a lie.
  capture = createCapture({ fftSize, smoothing: 0, minDecibels: -110, maxDecibels: -5 });
  frequencyData = new Float32Array(fftSize / 2);
  nextCaptureAt = 0;
  animationId = requestAnimationFrame(tick);
}

/** Stop capturing. History is kept unless `clear` is asked for. */
export function stopHistory(clear = true): void {
  cancelAnimationFrame(animationId);
  animationId = 0;
  capture?.dispose();
  capture = null;
  frequencyData = null;
  if (clear) historyBuffer.clear();
}

export function historyRunning(): boolean {
  return capture !== null;
}

function tick(): void {
  const analyser = capture?.analyser();
  const context = audioContext();
  if (!analyser || !frequencyData || !context) {
    if (animationId) animationId = requestAnimationFrame(tick);
    return;
  }

  const now = context.currentTime;
  if (now >= nextCaptureAt) {
    analyser.getFloatFrequencyData(frequencyData);
    historyBuffer.push({
      time: now,
      db: reduceToLogBands(
        frequencyData,
        bandOptions(context.sampleRate, analyser.fftSize),
        new Float32Array(SPECTROGRAM_BANDS)
      ),
      // Unsmoothed: a time axis must show when the note actually changed.
      pitchHz: rawPitchRef.value?.frequency ?? null
    });
    // Absolute pacing, so a slow frame does not shift the whole axis.
    nextCaptureAt = Math.max(now, nextCaptureAt + 1 / CAPTURE_HZ);
  }

  animationId = requestAnimationFrame(tick);
}
