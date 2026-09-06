/**
 * A drum kit: the instrument that proves the model.
 *
 * It has a surface and voices but no pitch, so it carries no `tuning` and
 * never reaches `buildTargets`. Any "universal instrument" abstraction
 * that could swallow a kit has stopped constraining anything.
 *
 * Tones are fundamentals in Hz, chosen by ear rather than by note: a kick
 * around 55 Hz, toms a fourth apart, metal as a noise band.
 */

import type { InstrumentDefinition, KitPiece } from "./types.js";

const PIECES: KitPiece[] = [
  // Top row: the metal, where a player's right hand lives.
  { id: "crash", timbre: "crash", tone: 5200, row: 0, column: 0, code: "KeyQ" },
  { id: "hihatClosed", timbre: "hihat", tone: 8200, row: 0, column: 1, code: "KeyW", choke: "hihat" },
  { id: "hihatOpen", timbre: "hihatOpen", tone: 8200, row: 0, column: 2, code: "KeyE", choke: "hihat" },
  { id: "ride", timbre: "ride", tone: 6400, row: 0, column: 3, code: "KeyR" },
  // Bottom row: the drums, low to high as they sit under the sticks.
  { id: "kick", timbre: "kick", tone: 55, row: 1, column: 0, code: "KeyA" },
  { id: "snare", timbre: "snare", tone: 1900, row: 1, column: 1, code: "KeyS" },
  { id: "tomLow", timbre: "tom", tone: 98, row: 1, column: 2, code: "KeyD" },
  { id: "tomMid", timbre: "tom", tone: 131, row: 1, column: 3, code: "KeyF" },
  { id: "tomHigh", timbre: "tom", tone: 175, row: 1, column: 4, code: "KeyG" }
];

export const drumKit = {
  id: "drums",
  name: { zh: "架子鼓", en: "Drum kit" },
  category: "percussion",
  surface: { kind: "pads", pieces: PIECES }
} satisfies InstrumentDefinition;
