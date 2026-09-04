/**
 * The session front door: start a source, stop it, clean up.
 *
 * The graph lives in source.ts, the two input kinds in mic-input.ts /
 * file-input.ts and the analysis in analysis.ts, so "how a microphone
 * fails" and "what the status pill reads" stay separate files.
 */

import { closeSession, setSourceInfo, setStatus, sourceStore } from "./source.js";
import { startMicrophone as startMic, micStream, stopMicStream } from "./mic-input.js";
import { fileObjectUrl, startAudioFile as startFile, teardownFile } from "./file-input.js";
import { stopAnalysis } from "./analysis.js";

export { sourceStore, type AudioDevice, type SourceMode } from "./source.js";
export { populateDevices } from "./devices.js";
export { setAudioHostContainer } from "./file-input.js";

async function stopSource(resetUi: boolean): Promise<void> {
  stopAnalysis();
  closeSession();
  teardownFile();
  stopMicStream();
  sourceStore.mode = "idle";

  if (resetUi) {
    setStatus("statusIdle", "idle");
    setSourceInfo("sourceInfoDefault");
  }
}

export function startMicrophone(): Promise<void> {
  return startMic(() => stopSource(false));
}

export function startAudioFile(file: File | undefined): Promise<void> {
  return startFile(file, () => stopSource(false));
}

export function stop(): Promise<void> {
  return stopSource(true);
}

/** Best-effort teardown for beforeunload. */
export function cleanup(): void {
  micStream()?.getTracks().forEach((track) => track.stop());
  const url = fileObjectUrl();
  if (url) URL.revokeObjectURL(url);
}
