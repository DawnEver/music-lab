/**
 * What the trace is showing: layers, window, colours, and where the view
 * is frozen. Reading persisted state is an explicit action, not a side
 * effect of importing this file.
 */

import { reactive } from "vue";
import { storedJson } from "../../../lib/persist.js";
import { COLORMAP_IDS, type ColormapId } from "../../../lib/colormap.js";
import { HISTORY_SECONDS, type ResolutionId } from "../../../audio/history.js";

export type TraceScale = "log" | "semitone";

export interface TraceState {
  /** The heat map of energy over time. */
  showSpectrogram: boolean;
  /** The detected fundamental as a line. */
  showPitch: boolean;
  /** This instant's energy against frequency, as a strip below. */
  showSpectrum: boolean;
  colormap: ColormapId;
  scale: TraceScale;
  /** Seconds of history on screen. */
  window: number;
  floorDb: number;
  ceilingDb: number;
  resolution: ResolutionId;
  /** Reference pitch as a MIDI note, or null for none. */
  referenceMidi: number | null;
  /** Follow whatever the tuner is working on instead of a pinned note. */
  followTuner: boolean;
  showHarmonics: boolean;
}

const WINDOWS = [2, 5, 10, 30];

function defaults(): TraceState {
  return {
    showSpectrogram: true,
    showPitch: true,
    showSpectrum: true,
    colormap: "magma",
    scale: "log",
    window: 10,
    floorDb: -90,
    ceilingDb: -20,
    resolution: "balanced",
    referenceMidi: null,
    followTuner: true,
    showHarmonics: false
  };
}

export const traceView = reactive<TraceState>(defaults());

/**
 * Where the view is looking. Live follows the right edge; a frozen view
 * holds an end time and can be scrubbed, which is the whole point of
 * keeping history rather than scrolling a canvas.
 */
export const playback = reactive({
  frozenAt: null as number | null,
  /** Pointer readout, or null when the pointer is away. */
  hover: null as { time: number; note: string; hz: number; db: number | null } | null
});

const stored = storedJson<TraceState>("trace", defaults, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<TraceState>;
  return {
    showSpectrogram: typeof value.showSpectrogram === "boolean" ? value.showSpectrogram : base.showSpectrogram,
    showPitch: typeof value.showPitch === "boolean" ? value.showPitch : base.showPitch,
    showSpectrum: typeof value.showSpectrum === "boolean" ? value.showSpectrum : base.showSpectrum,
    colormap: COLORMAP_IDS.includes(value.colormap as ColormapId) ? (value.colormap as ColormapId) : base.colormap,
    scale: value.scale === "semitone" ? "semitone" : base.scale,
    window: WINDOWS.includes(Number(value.window)) ? Number(value.window) : base.window,
    floorDb: inRange(value.floorDb, -120, -40) ?? base.floorDb,
    ceilingDb: inRange(value.ceilingDb, -60, 0) ?? base.ceilingDb,
    resolution:
      value.resolution === "time" || value.resolution === "frequency"
        ? value.resolution
        : base.resolution,
    referenceMidi: inRange(value.referenceMidi, 12, 120) ?? null,
    followTuner: typeof value.followTuner === "boolean" ? value.followTuner : base.followTuner,
    showHarmonics: typeof value.showHarmonics === "boolean" ? value.showHarmonics : base.showHarmonics
  };
},
// The tool was called "scope" before it was called "trace"; settings
// survive the rename.
"ml.scope");

function inRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/** Read persisted scope settings; the view calls this once. */
export function hydrateTrace(): void {
  Object.assign(traceView, stored.read());
}

export function persistTrace(): void {
  stored.write({ ...traceView });
}

export const WINDOW_CHOICES = WINDOWS;
/** Retention bounds how far a frozen view can scrub back. */
export const MAX_WINDOW = HISTORY_SECONDS;
