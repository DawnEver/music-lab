/**
 * Microphone input: permissions, constraints, and turning a denial into a
 * message a player can act on.
 */

import { t } from "../composables/useI18n.js";
import { showToast } from "../shared/stores/toast.js";
import {
  connectSource,
  openSession,
  setSourceInfo,
  setSourceInfoRaw,
  setStatus,
  sourceStore
} from "./source.js";
import { startAnalysis } from "./analysis.js";
import { populateDevices } from "./devices.js";

let stream: MediaStream | null = null;

export function micStream(): MediaStream | null {
  return stream;
}

export function stopMicStream(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

/** Raw analysis input: processing would fight the pitch detector. */
const CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1
};

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.name === "NotAllowedError") return t("toastMicDenied");
  if (error instanceof Error && error.name === "NotFoundError") return t("toastNoMic");
  return t("toastMicStartFailed", {
    message: error instanceof Error && error.message ? error.message : t("unknownError")
  });
}

export async function startMicrophone(stopCurrent: () => Promise<void>): Promise<void> {
  if (sourceStore.isStarting) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast(t("toastMicSecure"));
    setStatus("statusMicUnavailable", "error");
    return;
  }

  sourceStore.isStarting = true;
  setStatus("statusRequesting", "idle");

  try {
    await stopCurrent();
    sourceStore.isStarting = true;

    const audio: MediaTrackConstraints = { ...CONSTRAINTS };
    if (sourceStore.deviceId) audio.deviceId = { exact: sourceStore.deviceId };
    stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });

    const context = await openSession("mic");
    connectSource(context.createMediaStreamSource(stream));
    sourceStore.mode = "mic";

    const track = stream.getAudioTracks()[0];
    setSourceInfo("analyzing", { label: track?.label || t("defaultMic") });
    setStatus("statusMicLive", "live");
    startAnalysis();
    await populateDevices();
  } catch (error) {
    console.error(error);
    await stopCurrent();
    sourceStore.mode = "idle";
    setStatus("statusStartFailed", "error");

    const message = failureMessage(error);
    showToast(message);
    setSourceInfoRaw(message);
  } finally {
    sourceStore.isStarting = false;
  }
}
