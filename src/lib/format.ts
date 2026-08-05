/** Display helpers shared by tuner panels. */

/** "−30" / "0" / "+45" — signed cents without the unit. */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  const prefix = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)}`;
}
