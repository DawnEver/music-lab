/**
 * Workbench panel open/collapsed state, persisted across sessions.
 * All panels default to open (first visit shows the full workbench);
 * after that the user's layout is remembered.
 */

import { reactive } from "vue";
import { storedJson } from "../../lib/persist.js";

export const PANEL_IDS = ["tuner", "pitch", "chord", "settings"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

const DEFAULT_OPEN: Record<PanelId, boolean> = {
  tuner: true,
  pitch: true,
  chord: true,
  settings: true
};

const stored = storedJson<Record<PanelId, boolean>>(
  "panels",
  () => ({ ...DEFAULT_OPEN }),
  (raw, base) => {
    // Accepts both the current flat record and the legacy { v, open } shape.
    const parsed = raw as (Partial<Record<PanelId, boolean>> & { open?: Partial<Record<PanelId, boolean>> }) | null;
    const source = parsed?.open ?? parsed;
    if (!source) return base;
    for (const id of PANEL_IDS) {
      if (typeof source[id] === "boolean") base[id] = source[id]!;
    }
    return base;
  },
  "tcl-panels"
);

const open = reactive<Record<PanelId, boolean>>(stored.read());

function persist(): void {
  stored.write({ ...open });
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
