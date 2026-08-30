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

