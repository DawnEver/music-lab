/**
 * Capture taps: an AnalyserNode fed by whatever input is live.
 *
 * A tap is an instance, not a singleton, because the resolution trade-off
 * is per-view and irreconcilable: pitch detection wants a long window
 * (fine in frequency, blurred in time), a spectrogram wants a short one
 * (sharp in time, coarse in frequency). One analyser cannot serve both, and
 * a second one costs almost nothing.
 */

import { attachTap, audioContext, detachTap, onSourceChange } from "./source.js";

export interface CaptureOptions {
  fftSize: number;
  /** 0 keeps time sharp; the tuner smooths to steady its readouts. */
  smoothing?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

export interface Capture {
  /** Null until a source is running. */
  analyser(): AnalyserNode | null;
  sampleRate(): number;
  /** Change smoothing on the live analyser. */
  setSmoothing(value: number): void;
  /** Rebuild on the next source; call when a view is torn down. */
  dispose(): void;
}

export function createCapture(options: CaptureOptions): Capture {
  let analyser: AnalyserNode | null = null;
  let smoothing = options.smoothing ?? 0;

  function build(context: AudioContext | null): void {
    if (analyser) {
      detachTap(analyser);
      analyser = null;
    }
    if (!context) return;
    analyser = context.createAnalyser();
    analyser.fftSize = options.fftSize;
    analyser.minDecibels = options.minDecibels ?? -100;
    analyser.maxDecibels = options.maxDecibels ?? -10;
    analyser.smoothingTimeConstant = smoothing;
    attachTap(analyser);
  }

  build(audioContext());
  const unsubscribe = onSourceChange(build);

  return {
    analyser: () => analyser,
    sampleRate: () => audioContext()?.sampleRate ?? 48000,
    setSmoothing(value: number) {
      smoothing = value;
      if (analyser) analyser.smoothingTimeConstant = value;
    },
    dispose() {
      unsubscribe();
      if (analyser) detachTap(analyser);
      analyser = null;
    }
  };
}
