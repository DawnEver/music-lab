/**
 * Live analysis results, exposed as shallow refs replaced at analysis
 * cadence (~88/105 ms) — see audio/analysis.ts for the stream design.
 */

import {
  pitchRef,
  chordRef,
  chromaRef,
  levelRef,
  tickRef,
  keyEstimateRef
} from "../audio/analysis.js";

export function useAnalysis() {
  return {
    pitch: pitchRef,
    chord: chordRef,
    chroma: chromaRef,
    level: levelRef,
    tick: tickRef,
    keyEstimate: keyEstimateRef
  };
}
