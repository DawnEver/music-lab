/**
 * Instrument registry. The tuning model itself (targets, matching, the
 * derived detector band) lives in targets.ts; everything here is
 * framework-agnostic and unit-tested.
 */

import type {
  InstrumentDefinition,
  InstrumentTuning,
  TuningPreset,
  InstrumentCategory
} from "./types.js";
import { guitar } from "./guitar.js";
import { bass } from "./bass.js";
import { ukulele } from "./ukulele.js";
import { violin } from "./violin.js";
import { erhu } from "./erhu.js";
import { guzheng } from "./guzheng.js";
import { guqin } from "./guqin.js";
import { harmonica } from "./harmonica.js";
import { viola } from "./viola.js";
import { cello } from "./cello.js";
import { doubleBass } from "./double-bass.js";
import { mandolin } from "./mandolin.js";
import { banjo } from "./banjo.js";
import { pipa } from "./pipa.js";
import { ruan } from "./ruan.js";
import { liuqin } from "./liuqin.js";
import { zhonghu } from "./zhonghu.js";
import { gaohu } from "./gaohu.js";
import { kalimba } from "./kalimba.js";
import { dizi } from "./dizi.js";
import { xiao } from "./xiao.js";
import { saxophone } from "./saxophone.js";

export * from "./types.js";
export * from "./targets.js";

/** Picker order: by category, western before Chinese inside each group. */
export const allInstruments: InstrumentDefinition[] = [
  // plucked
  guitar,
  bass,
  ukulele,
  mandolin,
  banjo,
  pipa,
  ruan,
  liuqin,
  guzheng,
  guqin,
  // bowed
  violin,
  viola,
  cello,
  doubleBass,
  erhu,
  zhonghu,
  gaohu,
  // winds
  harmonica,
  dizi,
  xiao,
  saxophone,
  // other
  kalimba
];

/** Group order of the instrument picker. */
export const instrumentCategories: InstrumentCategory[] = ["plucked", "bowed", "winds", "other"];

/**
 * An instrument the tuner can work with. Narrowing by capability rather
 * than by a boolean flag means the compiler, not a comment, is what stops
 * a drum kit reaching `buildTargets`.
 */
export type TunedInstrument = InstrumentDefinition & { tuning: InstrumentTuning };

export function isTuned(instrument: InstrumentDefinition): instrument is TunedInstrument {
  return instrument.tuning !== undefined;
}

/** Everything the tuner offers, in picker order. */
export const tunedInstruments: TunedInstrument[] = allInstruments.filter(isTuned);

export function instrumentsByCategory<T extends InstrumentDefinition>(
  category: InstrumentCategory,
  from: readonly T[]
): T[];
export function instrumentsByCategory(category: InstrumentCategory): InstrumentDefinition[];
export function instrumentsByCategory(
  category: InstrumentCategory,
  from: readonly InstrumentDefinition[] = allInstruments
): InstrumentDefinition[] {
  return from.filter((instrument) => instrument.category === category);
}

export function getInstrument(id: string): InstrumentDefinition | null {
  return allInstruments.find((instrument) => instrument.id === id) ?? null;
}

export function getTunedInstrument(id: string): TunedInstrument | null {
  return tunedInstruments.find((instrument) => instrument.id === id) ?? null;
}

export function getPreset(instrument: TunedInstrument, presetId: string): TuningPreset {
  const { presets, defaultPresetId } = instrument.tuning;
  return (
    presets.find((preset) => preset.id === presetId) ??
    presets.find((preset) => preset.id === defaultPresetId)!
  );
}

export type StringStatus = "idle" | "in-tune" | "flat" | "sharp";

/**
 * Classify a target against its pitch. |cents| <= 5 counts as in tune;
 * below the confidence floor it reads as idle.
 */
export function stringStatus(cents: number, hasSignal: boolean, confidence: number): StringStatus {
  if (!hasSignal || confidence < 0.35) return "idle";
  if (Math.abs(cents) <= 5) return "in-tune";
  return cents < -5 ? "flat" : "sharp";
}

/** The layout variant to use for an instrument, by id. */
export function getVariant(instrument: TunedInstrument, variantId: string) {
  const variants = instrument.tuning.variants;
  if (!variants?.length) return null;
  return variants.find((variant) => variant.id === variantId) ?? variants[0];
}
