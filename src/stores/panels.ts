/**
 * Workbench panel open/collapsed state, persisted across sessions.
 * All panels default to open (first visit shows the full workbench);
 * after that the user's layout is remembered.
 */

import { reactive } from "vue";

const STORAGE_KEY = "tcl-panels";

export const PANEL_IDS = [
  "tuner",
  "pitch",
  "chord",
  "spectrum",
  "settings",
  "metroTempo",
  "metroMeter",
  "metroRhythm",
  "metroPractice",
  "metroSound"
] as const;
export type PanelId = (typeof PANEL_IDS)[number];

const DEFAULT_OPEN: Record<PanelId, boolean> = {
  tuner: true,
  pitch: true,
  chord: true,
  spectrum: true,
  settings: true,
  metroTempo: true,
  metroMeter: true,
  metroRhythm: true,
  metroPractice: true,
  metroSound: true
};

function load(): Record<PanelId, boolean> {
  const state = { ...DEFAULT_OPEN };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw) as { open?: Partial<Record<PanelId, boolean>> };
    for (const id of PANEL_IDS) {
      if (typeof parsed.open?.[id] === "boolean") {
        state[id] = parsed.open[id]!;
      }
    }
  } catch (_) {
    // Corrupted storage falls back to defaults.
  }
  return state;
}

const open = reactive<Record<PanelId, boolean>>(load());

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, open }));
  } catch (_) {
    // Persistence is best-effort.
  }
}

export function isOpen(id: PanelId): boolean {
  return open[id];
}

export function toggle(id: PanelId): void {
  open[id] = !open[id];
  persist();
}

export function panelOpenState(): Record<PanelId, boolean> {
  return open;
}
