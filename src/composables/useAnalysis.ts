/**
 * Live analysis results, exposed as shallow refs replaced at analysis
 * cadence (~88/105 ms) — see lib/analysis-loop.ts for the bridge design.
 */

import { pitchRef, chordRef, chromaRef, levelRef, tickRef, keyEstimateRef, spectrumTargets } from "../lib/analysis-loop.js";

export function useAnalysis() {
  return {
    pitch: pitchRef,
    chord: chordRef,
    chroma: chromaRef,
    level: levelRef,
    tick: tickRef,
    keyEstimate: keyEstimateRef,
    spectrumTargets
  };
}
