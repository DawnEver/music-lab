/**
 * Meter presets: simple, compound, and the additive meters that most
 * online metronomes cannot express.
 */

import { makeMeter, meterPulses, type Meter } from "./meter.js";

export interface MeterPreset {
  /** i18n key suffix — `meterGroup.<group>`. */
  group: "simple" | "compound" | "additive";
  meter: Meter;
  numerator: number;
}

function preset(group: MeterPreset["group"], denominator: 2 | 4 | 8 | 16, groups: number[]): MeterPreset {
  const meter = makeMeter(denominator, groups);
  return { group, meter, numerator: meterPulses(meter) };
}

export const METER_PRESETS: MeterPreset[] = [
  preset("simple", 4, [1]),
  preset("simple", 4, [1, 1]),
  preset("simple", 4, [1, 1, 1]),
  preset("simple", 4, [1, 1, 1, 1]),
  preset("simple", 4, [1, 1, 1, 1, 1]),
  preset("simple", 2, [1, 1]),
  preset("compound", 8, [3, 3]),
  preset("compound", 8, [3, 3, 3]),
  preset("compound", 8, [3, 3, 3, 3]),
  preset("additive", 8, [2, 3]),
  preset("additive", 8, [3, 2]),
  preset("additive", 8, [2, 2, 3]),
  preset("additive", 8, [2, 3, 2]),
  preset("additive", 8, [3, 2, 2]),
  preset("additive", 8, [3, 3, 3, 2]),
  preset("additive", 8, [2, 2, 2, 3]),
  preset("additive", 16, [3, 3, 3, 2, 2])
];

/** Closed set: the dictionary carries a `subdivision.<key>` for each. */
export type SubdivisionKey =
  | "quarter"
  | "eighth"
  | "triplet"
  | "sixteenth"
  | "quintuplet"
  | "sextuplet"
  | "septuplet";

export interface SubdivisionPreset {
  divisions: number;
  /** i18n key — `subdivision.<key>`. */
  key: SubdivisionKey;
}

export const SUBDIVISION_PRESETS: SubdivisionPreset[] = [
  { divisions: 1, key: "quarter" },
  { divisions: 2, key: "eighth" },
  { divisions: 3, key: "triplet" },
  { divisions: 4, key: "sixteenth" },
  { divisions: 5, key: "quintuplet" },
  { divisions: 6, key: "sextuplet" },
  { divisions: 7, key: "septuplet" }
];

export const POLYRHYTHM_PRESETS = [0, 2, 3, 4, 5, 7];
