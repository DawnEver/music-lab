/**
 * Per-pulse accents. Keeping this an editable array (rather than a
 * hardcoded "beat 1 is loud" rule) is what lets the same engine grow into
 * a rhythm trainer and a simple drum machine.
 */

import { groupStarts, meterPulses, type Meter } from "./meter.js";

export type Accent = "strong" | "medium" | "weak" | "subdivision" | "mute";

/** The states a user can cycle through by clicking a beat in the grid. */
const CYCLE: Accent[] = ["strong", "medium", "weak", "mute"];

/**
 * First group start is strong, later group starts medium, the rest weak.
 * A simple meter (all groups of one pulse) has no inner groups to stress,
 * so only its downbeat is accented.
 */
export function defaultAccents(meter: Meter): Accent[] {
  const grouped = meter.groups.some((size) => size > 1);
  const starts = new Set(grouped ? groupStarts(meter) : [0]);
  return Array.from({ length: meterPulses(meter) }, (_, index) => {
    if (index === 0) return "strong";
    return starts.has(index) ? "medium" : "weak";
  });
}

export function nextAccent(accent: Accent): Accent {
  const index = CYCLE.indexOf(accent);
  return CYCLE[(index + 1) % CYCLE.length] ?? "strong";
}

/** Keep existing edits when the bar length changes, filling with defaults. */
export function resizeAccents(accents: Accent[], meter: Meter): Accent[] {
  const fallback = defaultAccents(meter);
  return fallback.map((value, index) => accents[index] ?? value);
}
