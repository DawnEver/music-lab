/**
 * The audio graph itself: the lease on the shared context, the analyser,
 * whichever source is feeding it, and the monitoring gain.
 *
 * Deliberately non-reactive — Vue has no business tracking AudioNodes.
 * The graph is built the same way for every source; what differs (a
 * MediaStream, an <audio> element) belongs to the source modules.
 */

import { acquireAudio } from "../../../audio/audio-engine.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { clamp } from "../../../lib/dsp.js";
import { FFT_SIZE, startAnalysisLoop, stopAnalysisLoop } from "../../../lib/analysis-loop.js";
import { audioStore } from "./audio-state.js";

let lease: AudioEngineHandle | null = null;
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: AudioNode | null = null;
let outputGain: GainNode | null = null;

export function audioContext(): AudioContext | null {
  return context;
}

/** Apply the stability setting to a live analyser. */
export function applySmoothing(stability: number): void {
  if (analyser) analyser.smoothingTimeConstant = clamp(stability, 0.2, 0.92);
}

/**
 * Build mic -> analyser -> (silent) monitor, or file -> analyser -> audible
 * monitor. Monitoring the mic would feed back, so its gain is zero.
 */
export async function buildGraph(mode: "mic" | "file"): Promise<AudioContext> {
  lease = await acquireAudio();
  context = lease.context;

  analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = clamp(audioStore.stability, 0.2, 0.92);

  outputGain = context.createGain();
  outputGain.gain.value = mode === "mic" ? 0 : 0.92;
  analyser.connect(outputGain);
  outputGain.connect(lease.master);

  audioStore.sampleRate = context.sampleRate;
  return context;
}

/** Attach the source that feeds the analyser. */
export function connectSource(node: AudioNode): void {
  if (!analyser) return;
  sourceNode = node;
  node.connect(analyser);
}

/** Start the rAF analysis loop over the current analyser. */
export function beginAnalysis(): void {
  if (!analyser || !context) return;
  startAnalysisLoop({
    analyser,
    sampleRate: context.sampleRate,
    getTuning: () => audioStore.tuning,
    getGateDb: () => audioStore.gateDb,
    getStability: () => audioStore.stability
  });
}

/**
 * Tear the graph down. The context belongs to the engine, so the lease is
 * released rather than closed — a metronome running alongside keeps its
 * clock.
 */
export function teardownGraph(): void {
  stopAnalysisLoop();

  for (const node of [sourceNode, analyser, outputGain]) {
    try {
      node?.disconnect();
    } catch (_) {
      // Node may already be detached.
    }
  }
  sourceNode = null;
  analyser = null;
  outputGain = null;

  lease?.release();
  lease = null;
  context = null;
}
