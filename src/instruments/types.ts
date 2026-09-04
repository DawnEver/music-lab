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
export type InstrumentCategory = "plucked" | "bowed" | "winds" | "other";
/**
 * How the targets are presented: a list of rows (one pitch each), a
 * hole x breath grid (harmonica), or a fingering chart (winds, where a
 * target is a note and the interesting part is how to finger it).
 */
export type InstrumentLayout = "list" | "grid" | "fingering";

export type HoleState = "closed" | "open" | "half";

/** Closed set: the dictionary carries a `tuner.windKey.<key>` for each. */
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

export interface InstrumentDefinition {
  id: string;
  name: LocalizedName;
  category: InstrumentCategory;
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
