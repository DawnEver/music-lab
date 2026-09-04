import { reactive } from "vue";
import type { ModeKey } from "../../../lib/key.js";

export type SourceMode = "idle" | "mic" | "file";

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export const audioStore = reactive({
  mode: "idle" as SourceMode,
  statusKey: "statusIdle",
  statusMode: "idle" as "idle" | "live" | "error",
  sourceInfoKey: "sourceInfoDefault",
  sourceInfoParams: {} as Record<string, string>,
  sourceInfoOverride: "",
  tuning: 440,
  gateDb: -52,
  stability: 0.72,
  keyMode: "auto" as "auto" | "manual",
  keyTonic: 0,
  keyScale: "major" as ModeKey,
  isStarting: false,
  deviceId: "",
  devices: [] as AudioDevice[],
  sampleRate: 0
});


export function setStatus(key: string, mode: "idle" | "live" | "error"): void {
  audioStore.statusKey = key;
  audioStore.statusMode = mode;
}

/** Source line rendered from the dictionary. */
export function setSourceInfo(key: string, params: Record<string, string> = {}): void {
  audioStore.sourceInfoKey = key;
  audioStore.sourceInfoParams = params;
  audioStore.sourceInfoOverride = "";
}

/** Source line that is already translated (error messages). */
export function setSourceInfoRaw(text: string): void {
  audioStore.sourceInfoOverride = text;
}
