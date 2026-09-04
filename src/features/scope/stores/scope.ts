/**
 * What the scope is showing: layers, window, colours, and where the view
 * is frozen. Reading persisted state is an explicit action, not a side
 * effect of importing this file.
 */

import { reactive } from "vue";
import { storedJson } from "../../../lib/persist.js";
import { COLORMAP_IDS, type ColormapId } from "../../../lib/colormap.js";
import { HISTORY_SECONDS, type ResolutionId } from "../../../audio/history.js";

export type ScopeScale = "log" | "semitone";

export interface ScopeState {
  /** The heat map of energy over time. */
  showSpectrogram: boolean;
  /** The detected fundamental as a line. */
  showPitch: boolean;
  colormap: ColormapId;
  scale: ScopeScale;
  /** Seconds of history on screen. */
  window: number;
  floorDb: number;
  ceilingDb: number;
  resolution: ResolutionId;
  /** Reference pitch as a MIDI note, or null for none. */
  referenceMidi: number | null;
  showHarmonics: boolean;
}

const WINDOWS = [2, 5, 10, 30];

function defaults(): ScopeState {
  return {
    showSpectrogram: true,
    showPitch: true,
    colormap: "magma",
    scale: "log",
    window: 10,
    floorDb: -90,
    ceilingDb: -20,
    resolution: "balanced",
    referenceMidi: null,
    showHarmonics: false
  };
}

export const scope = reactive<ScopeState>(defaults());

/** Frozen playhead time, or null while following the live edge. */
export const playback = reactive({
  frozenAt: null as number | null
});

const stored = storedJson<ScopeState>("scope", defaults, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<ScopeState>;
  return {
    showSpectrogram: typeof value.showSpectrogram === "boolean" ? value.showSpectrogram : base.showSpectrogram,
    showPitch: typeof value.showPitch === "boolean" ? value.showPitch : base.showPitch,
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
    showHarmonics: typeof value.showHarmonics === "boolean" ? value.showHarmonics : base.showHarmonics
  };
});

function inRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/** Read persisted scope settings; the view calls this once. */
export function hydrateScope(): void {
  Object.assign(scope, stored.read());
}

export function persistScope(): void {
  stored.write({ ...scope });
}

export const WINDOW_CHOICES = WINDOWS;
export const MAX_WINDOW = HISTORY_SECONDS;
