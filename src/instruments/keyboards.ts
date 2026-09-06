/**
 * The keyboards: instruments you play but never tune.
 *
 * They carry no `tuning`, which is exactly the point — a player does not
 * set a piano's pitches, so it has nothing to offer the tuner and does not
 * appear there. What it does have is a surface and a voice.
 */

import type { InstrumentDefinition } from "./types.js";

export const piano = {
  id: "piano",
  name: { zh: "钢琴", en: "Piano" },
  category: "keys",
  surface: { kind: "keys" },
  timbre: "piano"
} satisfies InstrumentDefinition;

export const electricPiano = {
  id: "epiano",
  name: { zh: "电钢琴", en: "Electric piano" },
  category: "keys",
  surface: { kind: "keys" },
  timbre: "epiano"
} satisfies InstrumentDefinition;

export const organ = {
  id: "organ",
  name: { zh: "风琴", en: "Organ" },
  category: "keys",
  surface: { kind: "keys" },
  timbre: "organ"
} satisfies InstrumentDefinition;
