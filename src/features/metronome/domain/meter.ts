/**
 * Meter as an additive grouping, not a bare numerator/denominator pair.
 *
 * 7/8 alone does not say how to count it — 2+2+3, 2+3+2 and 3+2+2 sound
 * nothing alike. Storing `groups` makes the numerator a derived value and
 * gives the accent defaults something real to hang on.
 */

export type Denominator = 2 | 4 | 8 | 16;

export interface Meter {
  denominator: Denominator;
  /** Pulses per group, e.g. [2, 2, 3] for a 7/8 counted 2+2+3. */
  groups: number[];
}

/** Build a meter, normalizing junk groupings to a single pulse. */
export function makeMeter(denominator: Denominator, groups: number[]): Meter {
  const clean = groups.map((size) => Math.max(1, Math.round(size))).filter(Number.isFinite);
  return { denominator, groups: clean.length ? clean : [1] };
}

/** Total pulses in a bar — the numerator. */
export function meterPulses(meter: Meter): number {
  return meter.groups.reduce((sum, size) => sum + size, 0);
}

/** Index of the first pulse of every group. */
export function groupStarts(meter: Meter): number[] {
  const starts: number[] = [];
  let index = 0;
  for (const size of meter.groups) {
    starts.push(index);
    index += size;
  }
  return starts;
}

/** "4/4", or "7/8 (2+2+3)" when the grouping is not all ones. */
export function meterLabel(meter: Meter): string {
  const base = `${meterPulses(meter)}/${meter.denominator}`;
  if (meter.groups.every((size) => size === 1)) return base;
  return `${base} (${meter.groups.join("+")})`;
}

/** Compound time: eighth/sixteenth pulses grouped in threes (6/8, 9/8, 12/8). */
export function isCompound(meter: Meter): boolean {
  return (
    (meter.denominator === 8 || meter.denominator === 16) &&
    meter.groups.length > 1 &&
    meter.groups.every((size) => size === 3)
  );
}

/** Parse "2+2+3" / "2 2 3" / "223"-free input; null when unusable. */
export function parseGroups(input: string): number[] | null {
  const parts = input
    .split(/[^0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.length) return null;
  const groups = parts.map((part) => Number(part));
  if (groups.some((size) => !Number.isInteger(size) || size < 1 || size > 16)) return null;
  if (/[^0-9+\s,]/.test(input)) return null;
  return groups;
}

export function metersEqual(a: Meter, b: Meter): boolean {
  return a.denominator === b.denominator && a.groups.join("+") === b.groups.join("+");
}
