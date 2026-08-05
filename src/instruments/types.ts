/**
 * Instrument data contract. Adding a new instrument is adding one data
 * file that exports an InstrumentDefinition — the registry, tuner panels,
 * and detector-range wiring all derive from it. Optionally provide a
 * custom layout component (e.g. the harmonica blow/draw grid).
 */

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
}

export interface PitchBounds {
  minHz: number;
  maxHz: number;
  minMidi: number;
  maxMidi: number;
}

export type InstrumentCategory = "strings" | "winds";
export type InstrumentLayout = "strings" | "harmonica";

export type Breath = "blow" | "draw";

/** A pitch target of a (hole × breath) cell: the standard note plus its
 *  bend / overblow / overdraw positions. */
export interface HarmonicaPosition {
  kind: "blow" | "draw" | "bend" | "overblow" | "overdraw";
  /** Offset from the key root (semitones). */
  semitone: number;
  /** Absolute MIDI note of this position. */
  midi: number;
  /** 1..3 for bends (1 = shallowest, higher = deeper). */
  bendLevel?: number;
}

export interface HarmonicaCell {
  /** 1-based hole number. */
  hole: number;
  breath: Breath;
  /** Standard position first, then bends, then overblow/overdraw. */
  positions: HarmonicaPosition[];
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
  /** Holes with a usable overblow (+1 semitone on blow). */
  overblowHoles: number[];
  /** Holes with a usable overdraw (+1 semitone on draw). */
  overdrawHoles: number[];
}

export interface InstrumentDefinition {
  id: string;
  name: LocalizedName;
  category: InstrumentCategory;
  /** Which panel renders this instrument. */
  layout: InstrumentLayout;
  presets: TuningPreset[];
  defaultPresetId: string;
  /** Detector band for this instrument (fed into the PitchRange). */
  range: PitchBounds;
  /** Present when layout === "harmonica". */
  harmonica?: HarmonicaLayout;
}
