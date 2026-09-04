/**
 * Instrument registry and pure tuning helpers (nearest-string matching,
 * status thresholds, harmonica cell/position generation). All functions
 * are framework-agnostic and unit-tested.
 */

import { midiToFrequency } from "../lib/music-theory.js";
import type {
  InstrumentDefinition,
  TuningPreset,
  HarmonicaCell,
  HarmonicaPosition,
  HarmonicaLayout,
  Breath
} from "./types.js";
import { guitar } from "./guitar.js";
import { bass } from "./bass.js";
import { ukulele } from "./ukulele.js";
import { violin } from "./violin.js";
import { erhu } from "./erhu.js";
import { guzheng } from "./guzheng.js";
import { guqin } from "./guqin.js";
import { harmonica } from "./harmonica.js";

export * from "./types.js";

export const allInstruments: InstrumentDefinition[] = [
  guitar,
  bass,
  ukulele,
  violin,
  erhu,
  guzheng,
  guqin,
  harmonica
];

export function getInstrument(id: string): InstrumentDefinition | null {
  return allInstruments.find((instrument) => instrument.id === id) ?? null;
}

export function getPreset(instrument: InstrumentDefinition, presetId: string): TuningPreset {
  return (
    instrument.presets.find((preset) => preset.id === presetId) ??
    instrument.presets.find((preset) => preset.id === instrument.defaultPresetId)!
  );
}

/** Match a frequency to the nearest string of a tuning (guitar, guzheng…). */
export function nearestString(
  frequency: number,
  midiNotes: number[],
  tuningHz = 440
): { index: number; targetMidi: number; cents: number } | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;

  let best: { index: number; targetMidi: number; cents: number } | null = null;
  for (let index = 0; index < midiNotes.length; index += 1) {
    const target = midiToFrequency(midiNotes[index], tuningHz);
    const cents = 1200 * Math.log2(frequency / target);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) {
      best = { index, targetMidi: midiNotes[index], cents };
    }
  }
  return best;
}

export type StringStatus = "idle" | "in-tune" | "flat" | "sharp";

/** Classify a string/position against its target. |
 * |cents| <= 5 counts as in tune; below the confidence floor it's idle. */
export function stringStatus(cents: number, hasSignal: boolean, confidence: number): StringStatus {
  if (!hasSignal || confidence < 0.35) return "idle";
  if (Math.abs(cents) <= 5) return "in-tune";
  return cents < -5 ? "flat" : "sharp";
}

const POSITION_PRECEDENCE: Record<HarmonicaPosition["kind"], number> = {
  blow: 0,
  draw: 0,
  bend: 1,
  overblow: 2,
  overdraw: 3
};

export interface NearestPositionResult {
  hole: number;
  breath: Breath;
  position: HarmonicaPosition;
  cents: number;
}

/**
 * Match a frequency to the nearest (hole × breath × position) across all
 * cells of a harmonica key. Ties resolve to standard notes over bends,
 * bends over overblows/overdraws, then to the lower hole.
 */
export function nearestPosition(
  frequency: number,
  cells: HarmonicaCell[],
  tuningHz = 440
): NearestPositionResult | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;

  let best: NearestPositionResult | null = null;
  let bestKey: [number, number, number] | null = null;

  for (const cell of cells) {
    for (const position of cell.positions) {
      const target = midiToFrequency(position.midi, tuningHz);
      const cents = 1200 * Math.log2(frequency / target);
      const key: [number, number, number] = [
        Math.abs(cents),
        POSITION_PRECEDENCE[position.kind],
        cell.hole
      ];
      if (!bestKey || compareKeys(key, bestKey) < 0) {
        best = { hole: cell.hole, breath: cell.breath, position, cents };
        bestKey = key;
      }
    }
  }

  return best;
}

function compareKeys(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** Build every (hole × breath) cell of a key with its position targets. */
export function buildHarmonicaCells(
  layout: HarmonicaLayout,
  keyRootMidi: number
): HarmonicaCell[] {
  const cells: HarmonicaCell[] = [];

  // An overblow/overdraw sounds the *opposite* reed of the hole, driven one
  // semitone above its own pitch: an overblow is the draw reed + 1, an
  // overdraw the blow reed + 1. That is why overblows only exist where the
  // draw reed is the higher one (holes 1-6) and overdraws where the blow
  // reed is (holes 7-10).
  const buildBreath = (
    breath: Breath,
    standard: number[],
    depth: Record<number, number>,
    extras: number[],
    opposite: number[]
  ) => {
    for (let hole = 1; hole <= layout.holeCount; hole += 1) {
      const standardSemitone = standard[hole - 1];
      const positions: HarmonicaPosition[] = [
        {
          kind: breath,
          semitone: standardSemitone,
          midi: keyRootMidi + standardSemitone
        }
      ];

      const maxBend = depth[hole] ?? 0;
      for (let level = 1; level <= maxBend; level += 1) {
        const semitone = standardSemitone - level;
        positions.push({
          kind: "bend",
          semitone,
          midi: keyRootMidi + semitone,
          bendLevel: level
        });
      }

      if (extras.includes(hole)) {
        const semitone = opposite[hole - 1] + 1;
        positions.push({
          kind: breath === "blow" ? "overblow" : "overdraw",
          semitone,
          midi: keyRootMidi + semitone
        });
      }

      cells.push({ hole, breath, positions });
    }
  };

  buildBreath("blow", layout.blowOffsets, layout.blowBendDepth, layout.overblowHoles, layout.drawOffsets);
  buildBreath("draw", layout.drawOffsets, layout.drawBendDepth, layout.overdrawHoles, layout.blowOffsets);

  return cells;
}
