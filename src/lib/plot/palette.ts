/**
 * Canvas colours, read from the CSS tokens.
 *
 * Canvas cannot resolve `var(--x)`, which is why these used to be a second
 * hard-coded copy of the palette in draw.ts. Reading the computed tokens
 * once per theme keeps a single source: change tokens.css and the plots
 * follow.
 */

const KEYS = [
  "surface",
  "axis",
  "grid",
  "fill1",
  "fill2",
  "fill3",
  "stroke1",
  "stroke2",
  "stroke3",
  "glow",
  "marker",
  "chipBg",
  "chipBorder",
  "chipText",
  "track",
  "trackGlow",
  "reference",
  "harmonic"
] as const;

export type PlotPalette = Record<(typeof KEYS)[number], string>;

const CSS_NAMES: Record<(typeof KEYS)[number], string> = {
  surface: "--plot-surface",
  axis: "--plot-axis",
  grid: "--plot-grid",
  fill1: "--plot-fill-1",
  fill2: "--plot-fill-2",
  fill3: "--plot-fill-3",
  stroke1: "--plot-stroke-1",
  stroke2: "--plot-stroke-2",
  stroke3: "--plot-stroke-3",
  glow: "--plot-glow",
  marker: "--plot-marker",
  chipBg: "--plot-chip-bg",
  chipBorder: "--plot-chip-border",
  chipText: "--plot-chip-text",
  track: "--plot-track",
  trackGlow: "--plot-track-glow",
  reference: "--plot-reference",
  harmonic: "--plot-harmonic"
};

/** Used when there is no document (tests) or a token is missing. */
const FALLBACK = "rgba(148,163,184,0.5)";

let cached: { theme: string; palette: PlotPalette } | null = null;

function currentTheme(): string {
  return typeof document === "undefined" ? "dark" : document.documentElement.dataset.theme ?? "dark";
}

/** The palette for the active theme, recomputed only when the theme changes. */
export function plotPalette(): PlotPalette {
  const theme = currentTheme();
  if (cached && cached.theme === theme) return cached.palette;

  const palette = {} as PlotPalette;
  const styles = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  for (const key of KEYS) {
    palette[key] = styles?.getPropertyValue(CSS_NAMES[key]).trim() || FALLBACK;
  }
  cached = { theme, palette };
  return palette;
}

/** The monospace stack the plots label with. */
export function plotFont(sizePx: number): string {
  const family =
    typeof document === "undefined"
      ? "monospace"
      : getComputedStyle(document.documentElement).getPropertyValue("--font-mono") || "monospace";
  return `${sizePx}px ${family}`;
}

/** Which background the plots are drawn on, for choosing a colour ramp. */
export function plotPolarity(): "onDark" | "onLight" {
  return currentTheme() === "light" ? "onLight" : "onDark";
}

/** Drop the cache — the theme toggle calls this so the next frame re-reads. */
export function invalidatePlotPalette(): void {
  cached = null;
}
