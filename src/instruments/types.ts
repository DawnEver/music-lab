/**
 * Instrument data contract. Adding a new instrument is adding one data
 * file that exports an InstrumentDefinition — the registry, tuner panels,
 * and detector-range wiring all derive from it.
 *
 * The capabilities are separate and each is optional, because instruments
 * do not all have all of them. A piano has no tuning a player would set;
 * a drum kit has no pitch at all; a guqin can be tuned long before anyone
 * writes a timbre for it. Forcing one shape on all three is what makes an
 * abstraction stop constraining anything.
 */

import type { TimbreId } from "../audio/timbre.js";

export interface LocalizedName {
  zh: string;
  en: string;
}

/** A selectable tuning of an instrument (guitar Drop D, guqin 调式, harmonica key). */
export interface TuningPreset {
  id: string;
  name: LocalizedName;
  /** MIDI notes in display order (string 1 of the instrument first). */
  notes: number[];
  /** Parallel display labels (string numbers, 内弦/外弦, 一弦…七弦…). */
  noteLabels?: LocalizedName[];
  /**
   * Parallel fingerings, for wind instruments: how each note in `notes` is
   * produced. Same length and order as `notes`.
   */
  fingerings?: Fingering[];
}

export interface PitchBounds {
  minHz: number;
  maxHz: number;
  minMidi: number;
  maxMidi: number;
}

/** Grouping in the instrument picker, by how the instrument is sounded. */
export type InstrumentCategory =
  | "keys"
  | "plucked"
  | "bowed"
  | "winds"
  | "percussion"
  | "other";
/**
 * How the targets are presented: a list of rows (one pitch each), a
 * hole x breath grid (harmonica), or a fingering chart (winds, where a
 * target is a note and the interesting part is how to finger it).
 */
export type InstrumentLayout = "list" | "grid" | "fingering";

export type HoleState = "closed" | "open" | "half";

/** Closed set: the dictionary carries an `instrument.windKey.<key>` for each. */
export type WindKey = "octave" | "overblow";

/** How a wind instrument's holes and keys are held for one note. */
export interface Fingering {
  /** Hole states from the mouthpiece end downward. */
  holes: HoleState[];
  /** Extra keys or techniques held on top (octave key, overblowing). */
  keys?: WindKey[];
}

/** Hole geometry of a wind instrument, for drawing its chart. */
export interface WindLayout {
  holeCount: number;
  /** Holes played by a thumb on the back of the instrument (1-based). */
  backHoles?: number[];
  /** Named keys the chart may show beside the holes. */
  keyLabels?: WindKey[];
}

/** Richter-style bend/overblow capabilities of the layout, per hole. */
export interface HarmonicaLayout {
  holeCount: number;
  blowOffsets: number[];
  drawOffsets: number[];
  /** Hole -> max draw-bend depth in semitones. */
  drawBendDepth: Record<number, number>;
  /** Hole -> max blow-bend depth in semitones (holes 7–10). */
  blowBendDepth: Record<number, number>;
  /** Holes with a usable overblow (the draw reed + 1 semitone). */
  overblowHoles: number[];
  /** Holes with a usable overdraw (the blow reed + 1 semitone). */
  overdrawHoles: number[];
}

/**
 * An alternative reed layout of the same instrument (harmonica tunings:
 * Richter standard, Paddy Richter…). Keys stay in `presets`; the variant
 * only changes which reed sits in which hole.
 */
export interface LayoutVariant {
  id: string;
  name: LocalizedName;
  reeds: HarmonicaLayout;
}

/**
 * How an instrument is played, and therefore how it is drawn. A union
 * rather than a flag: a fretboard needs a fret count and a keyboard does
 * not, and the two should not both carry the other's fields.
 */
export type PlaySurface =
  | { kind: "keys" }
  | { kind: "frets"; frets: number }
  | { kind: "pads"; pieces: KitPiece[] }
  | { kind: "holes" };

/** Closed set: the dictionary carries a `kit.<id>` for each. */
export type KitPieceId =
  | "kick"
  | "snare"
  | "hihatClosed"
  | "hihatOpen"
  | "tomHigh"
  | "tomMid"
  | "tomLow"
  | "crash"
  | "ride";

/**
 * One thing you hit. It has a voice and a frequency but deliberately no
 * MIDI note: a drum has a fundamental, not a pitch, and giving it a note
 * number would put it back among the things that can be out of tune.
 */
export interface KitPiece {
  id: KitPieceId;
  timbre: TimbreId;
  /** Fundamental in Hz — for noise voices, the band's corner. */
  tone: number;
  /** Grid placement on the pad surface. */
  row: number;
  column: number;
  /** `KeyboardEvent.code` that strikes it. */
  code: string;
  /**
   * Pieces sharing a choke group cut each other off. It is one field, and
   * it is the only reason a closed hi-hat sounds like a hi-hat.
   */
  choke?: string;
}

/** Everything the tuner needs. Absent means the instrument is not tuned. */
export interface InstrumentTuning {
  /** Which panel renders this instrument. */
  layout: InstrumentLayout;
  presets: TuningPreset[];
  defaultPresetId: string;
  /**
   * Detector band override. Normally omitted — `deriveRange()` computes it
   * from every pitch the instrument can produce, so the band cannot drift
   * away from the data.
   */
  range?: PitchBounds;
  /** Present when layout === "grid" — the default reed layout. */
  reeds?: HarmonicaLayout;
  /** Present when layout === "fingering". */
  wind?: WindLayout;
  /** Selectable reed layouts; the first one is the default. */
  variants?: LayoutVariant[];
  defaultVariantId?: string;
}

export interface InstrumentDefinition {
  id: string;
  name: LocalizedName;
  category: InstrumentCategory;
  /** Present when the instrument appears in the tuner. */
  tuning?: InstrumentTuning;
  /** Present when the instrument can be played; names a voice. */
  timbre?: TimbreId;
  /** Present when the instrument has a playing surface to draw. */
  surface?: PlaySurface;
}
