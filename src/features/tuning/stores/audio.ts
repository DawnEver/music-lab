/**
 * The tuning tool's audio session: which source is live, what the UI says
 * about it, and the analysis settings.
 *
 * This module is the session's front door only. The graph lives in
 * audio-graph.ts and the two input kinds in mic-source.ts / file-source.ts,
 * so "how a microphone fails" and "what the status pill reads" stop being
 * the same file.
 */

import { applySmoothing, teardownGraph } from "./audio-graph.js";
import { startMicrophone as startMic } from "./mic-source.js";
import { micStream, stopMicStream } from "./mic-source.js";
import { fileObjectUrl, startAudioFile as startFile, teardownFile } from "./file-source.js";
import { audioStore, setSourceInfo, setStatus } from "./audio-state.js";

export { audioStore, type AudioDevice, type SourceMode } from "./audio-state.js";
export { populateDevices } from "./device-discovery.js";
export { setAudioHostContainer } from "./file-source.js";
export { showToast, toastMessage, toastVisible } from "../../../shared/stores/toast.js";

export function updateSettings(tuning: number, gateDb: number, stability: number): void {
  audioStore.tuning = tuning;
  audioStore.gateDb = gateDb;
  audioStore.stability = stability;
  applySmoothing(stability);
}

async function stopAudio(resetUi: boolean): Promise<void> {
  teardownGraph();
  teardownFile();
  stopMicStream();
  audioStore.mode = "idle";

  if (resetUi) {
    setStatus("statusIdle", "idle");
    setSourceInfo("sourceInfoDefault");
  }
}

export function startMicrophone(): Promise<void> {
  return startMic(() => stopAudio(false));
}

export function startAudioFile(file: File | undefined): Promise<void> {
  return startFile(file, () => stopAudio(false));
}

export function stop(): Promise<void> {
  return stopAudio(true);
}

/** Best-effort teardown for beforeunload. */
export function cleanup(): void {
  micStream()?.getTracks().forEach((track) => track.stop());
  const url = fileObjectUrl();
  if (url) URL.revokeObjectURL(url);
}
