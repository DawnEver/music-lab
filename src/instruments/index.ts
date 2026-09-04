/**
 * Instrument registry. The tuning model itself (targets, matching, the
 * derived detector band) lives in targets.ts; everything here is
 * framework-agnostic and unit-tested.
 */

import type { InstrumentDefinition, TuningPreset, InstrumentCategory } from "./types.js";
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

export function instrumentsByCategory(
  category: InstrumentCategory
): InstrumentDefinition[] {
  return allInstruments.filter((instrument) => instrument.category === category);
}

export function getInstrument(id: string): InstrumentDefinition | null {
  return allInstruments.find((instrument) => instrument.id === id) ?? null;
}

export function getPreset(instrument: InstrumentDefinition, presetId: string): TuningPreset {
  return (
    instrument.presets.find((preset) => preset.id === presetId) ??
    instrument.presets.find((preset) => preset.id === instrument.defaultPresetId)!
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
export function getVariant(instrument: InstrumentDefinition, variantId: string) {
  const variants = instrument.variants;
  if (!variants?.length) return null;
  return variants.find((variant) => variant.id === variantId) ?? variants[0];
}
