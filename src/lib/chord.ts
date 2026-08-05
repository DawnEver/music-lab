/**
 * Chord recognition: match a 12-bin chroma vector against chord templates.
 * Pure functions, safe to import in Node. UI-level frame stabilization
 * lives in the analysis loop.
 */

import { NOTE_NAMES, CHORD_TYPES, type ChordType } from "./music-theory.js";
import { clamp } from "./dsp.js";

/** True when at least three substantial chroma bins exist (polyphony hint). */
export function hasPolyphonicEvidence(chroma: Float32Array | number[]): boolean {
  const values = Array.from(chroma).sort((a, b) => b - a);
  const strongest = values[0] || 0;
  if (strongest <= 0) return false;
  return (values[1] || 0) > strongest * 0.32 && (values[2] || 0) > strongest * 0.16;
}

export interface ChordCandidate {
  root: number;
  type: ChordType;
  score: number;
  tones: number[];
}

export interface ChordResult extends ChordCandidate {
  confidence: number;
  symbol: string;
  description: string;
  descriptionKey: string;
  alternate: string;
}

/**
 * Score every root/chord-type template against the chroma vector and return
 * the best match, or null when nothing clears the confidence threshold.
 */
export function detectChord(chroma: Float32Array | number[]): ChordResult | null {
  const total = Array.from(chroma).reduce((sum, value) => sum + value, 0);
  const maxValue = Math.max(...chroma);
  if (total < 1e-7 || maxValue <= 0) return null;

  const sortedValues = Array.from(chroma).sort((a, b) => b - a);
  if ((sortedValues[1] || 0) / maxValue < 0.22) {
    return null;
  }

  const chromaNorm =
    Math.sqrt(Array.from(chroma).reduce((sum, value) => sum + value * value, 0)) || 1;
  const matches: ChordCandidate[] = [];

  for (let root = 0; root < 12; root += 1) {
    for (const type of CHORD_TYPES) {
      const template = new Float32Array(12);
      const toneSet = new Set<number>();
      let templateNormSq = 0;
      let weightSum = 0;

      type.intervals.forEach((interval, index) => {
        const pitchClass = (root + interval) % 12;
        const weight = type.weights[index];
        template[pitchClass] = weight;
        toneSet.add(pitchClass);
        templateNormSq += weight * weight;
        weightSum += weight;
      });

      const templateNorm = Math.sqrt(templateNormSq) || 1;
      let dot = 0;
      let outside = 0;
      let missingWeight = 0;

      for (let pc = 0; pc < 12; pc += 1) {
        dot += chroma[pc] * template[pc];
        if (!toneSet.has(pc)) outside += chroma[pc];
      }

      type.intervals.forEach((interval, index) => {
        const pitchClass = (root + interval) % 12;
        if (chroma[pitchClass] < maxValue * 0.12) {
          missingWeight += type.weights[index];
        }
      });

      const cosine = dot / (chromaNorm * templateNorm);
      const missing = missingWeight / Math.max(weightSum, 1e-9);
      const rootPresence = chroma[root] / maxValue;
      const score =
        cosine -
        outside * 0.14 -
        missing * 0.06 +
        rootPresence * 0.018 -
        Math.max(0, type.intervals.length - 3) * 0.012;

      matches.push({
        root,
        type,
        score,
        tones: type.intervals.map((interval) => (root + interval) % 12)
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  const second = matches[1];

  if (!best || best.score < 0.66) return null;

  const margin = second ? Math.max(0, best.score - second.score) : 0.2;
  const confidence = clamp((best.score - 0.58) * 1.25 + margin * 2.2, 0, 1);

  return {
    ...best,
    confidence,
    symbol: `${NOTE_NAMES[best.root]}${best.type.suffix}`,
    description: best.type.name,
    descriptionKey: best.type.key,
    alternate: second ? `${NOTE_NAMES[second.root]}${second.type.suffix}` : ""
  };
}
