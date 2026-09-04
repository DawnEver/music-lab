/**
 * The tuner's one model: a preset is a list of pitch targets.
 *
 * A guitar string, a guzheng string, a kalimba tine and a harmonica hole
 * are the same thing — something you play that should sound a known
 * pitch. They differ only in how many pitches one target can produce (a
 * string has one, a harmonica hole has a standard note plus bends and
 * overbends) and in how they are arranged on screen (a list, or a grid of
 * hole × breath). Both differences are data, so matching, selection and
 * the detector band are written once.
 */

import { midiToFrequency } from "../lib/music-theory.js";
import type {
  HarmonicaLayout,
  InstrumentDefinition,
  LocalizedName,
  PitchBounds,
  TuningPreset
} from "./types.js";

/** A grid column: the two ways to sound a hole. */
export type Breath = "blow" | "draw";

export type PositionKind = "open" | Breath | "bend" | "overblow" | "overdraw";

/** One pitch a target can produce. */
export interface TargetPosition {
  kind: PositionKind;
  midi: number;
  /** Semitones from the key root (grid instruments). */
  semitone?: number;
  /** 1..3 for bends (1 = shallowest). */
  bendLevel?: number;
}

/** Something you play: a string, a tine, a hole × breath. */
export interface TuningTarget {
  /** Stable inside a preset: "s3", "h3-draw". */
  id: string;
  label: LocalizedName;
  /** The standard pitch first, then bends, then overbends. */
  positions: TargetPosition[];
  /** Grid placement; absent for list layouts. */
  slot?: { row: number; column: Breath };
}

const POSITION_PRECEDENCE: Record<PositionKind, number> = {
  open: 0,
  blow: 0,
  draw: 0,
  bend: 1,
  overblow: 2,
  overdraw: 3
};

/** Build the targets of a preset (with the active layout variant, if any). */
export function buildTargets(
  instrument: InstrumentDefinition,
  preset: TuningPreset,
  reeds?: HarmonicaLayout | null
): TuningTarget[] {
  if (instrument.layout === "grid") {
    const layout = reeds ?? instrument.reeds;
    if (!layout) return [];
    return buildGridTargets(layout, preset.notes[0] - layout.blowOffsets[0]);
  }
  return preset.notes.map((midi, index) => ({
    id: `s${index + 1}`,
    label: preset.noteLabels?.[index] ?? { zh: String(index + 1), en: String(index + 1) },
    positions: [{ kind: "open", midi }]
  }));
}

/**
 * A 10-hole diatonic harp: two targets per hole (blow and draw), each
 * carrying its bends and its overbend.
 *
 * An overbend sounds the *opposite* reed of the hole one semitone above
 * its own pitch — an overblow is the draw reed + 1, an overdraw the blow
 * reed + 1 — which is why overblows only exist where the draw reed is the
 * higher one and overdraws where the blow reed is.
 */
function buildGridTargets(layout: HarmonicaLayout, keyRootMidi: number): TuningTarget[] {
  const targets: TuningTarget[] = [];

  const buildColumn = (
    column: Breath,
    standard: number[],
    depth: Record<number, number>,
    overbendHoles: number[],
    opposite: number[]
  ) => {
    for (let hole = 1; hole <= layout.holeCount; hole += 1) {
      const standardSemitone = standard[hole - 1];
      const positions: TargetPosition[] = [
        { kind: column, semitone: standardSemitone, midi: keyRootMidi + standardSemitone }
      ];

      const maxBend = depth[hole] ?? 0;
      for (let level = 1; level <= maxBend; level += 1) {
        const semitone = standardSemitone - level;
        positions.push({ kind: "bend", semitone, midi: keyRootMidi + semitone, bendLevel: level });
      }

      if (overbendHoles.includes(hole)) {
        const semitone = opposite[hole - 1] + 1;
        positions.push({
          kind: column === "blow" ? "overblow" : "overdraw",
          semitone,
          midi: keyRootMidi + semitone
        });
      }

      targets.push({
        id: `h${hole}-${column}`,
        label: { zh: String(hole), en: String(hole) },
        positions,
        slot: { row: hole, column }
      });
    }
  };

  buildColumn("blow", layout.blowOffsets, layout.blowBendDepth, layout.overblowHoles, layout.drawOffsets);
  buildColumn("draw", layout.drawOffsets, layout.drawBendDepth, layout.overdrawHoles, layout.blowOffsets);

  return targets;
}

export interface TargetMatch {
  targetIndex: number;
  positionIndex: number;
  target: TuningTarget;
  position: TargetPosition;
  cents: number;
}

/**
 * Match a frequency to the nearest position of any target. Ties resolve to
 * standard notes over bends, bends over overbends, then to the earlier
 * target — so a played F on a C harp is hole 2's bend, not hole 1's
 * overblow.
 */
export function nearestTarget(
  frequency: number,
  targets: TuningTarget[],
  tuningHz = 440
): TargetMatch | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;

  let best: TargetMatch | null = null;
  let bestKey: [number, number, number] | null = null;

  targets.forEach((target, targetIndex) => {
    target.positions.forEach((position, positionIndex) => {
      const cents = 1200 * Math.log2(frequency / midiToFrequency(position.midi, tuningHz));
      const key: [number, number, number] = [
        Math.abs(cents),
        POSITION_PRECEDENCE[position.kind],
        targetIndex
      ];
      if (!bestKey || compareKeys(key, bestKey) < 0) {
        best = { targetIndex, positionIndex, target, position, cents };
        bestKey = key;
      }
    });
  });

  return best;
}

function compareKeys(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** Semitones of headroom the detector band keeps around the extremes. */
const RANGE_MARGIN_SEMITONES = 2;

/**
 * The detector band an instrument needs, derived from every pitch it can
 * actually produce. Deriving beats hand-maintaining: the band can never
 * drift away from the data it is supposed to cover.
 */
export function deriveRange(instrument: InstrumentDefinition): PitchBounds {
  if (instrument.range) return instrument.range;

  const variants = instrument.variants ?? [null];
  let minMidi = Infinity;
  let maxMidi = -Infinity;

  for (const preset of instrument.presets) {
    for (const variant of variants) {
      for (const target of buildTargets(instrument, preset, variant?.reeds)) {
        for (const position of target.positions) {
          if (position.midi < minMidi) minMidi = position.midi;
          if (position.midi > maxMidi) maxMidi = position.midi;
        }
      }
    }
  }

  const low = minMidi - RANGE_MARGIN_SEMITONES;
  const high = maxMidi + RANGE_MARGIN_SEMITONES;
  return {
    minMidi: low,
    maxMidi: high,
    minHz: midiToFrequency(low),
    maxHz: midiToFrequency(high)
  };
}
