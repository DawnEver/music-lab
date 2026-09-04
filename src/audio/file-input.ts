/**
 * Local file input: an <audio> element the player controls, routed through
 * the same analyser as the microphone.
 */

import { t } from "../composables/useI18n.js";
import { showToast } from "../shared/stores/toast.js";
import {
  audioContext,
  connectSource,
  openSession,
  setSourceInfo,
  setSourceInfoRaw,
  setStatus,
  sourceStore
} from "./source.js";
import { startAnalysis } from "./analysis.js";

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let hostContainer: HTMLElement | null = null;

/** Container that receives the <audio> element in file mode. */
export function setAudioHostContainer(el: HTMLElement | null): void {
  hostContainer = el;
}

export function fileObjectUrl(): string | null {
  return objectUrl;
}

export function teardownFile(): void {
  if (element) {
    element.pause();
    element.removeAttribute("src");
    element.load();
    element = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  hostContainer?.replaceChildren();
}

function trackPlaybackStatus(audio: HTMLAudioElement): void {
  audio.addEventListener("play", async () => {
    const context = audioContext();
    if (context?.state === "suspended") await context.resume();
    setStatus("statusFilePlaying", "live");
  });
  audio.addEventListener("pause", () => {
    if (sourceStore.mode === "file") setStatus("statusFilePaused", "idle");
  });
  audio.addEventListener("ended", () => {
    if (sourceStore.mode === "file") setStatus("statusFileEnded", "idle");
  });
  audio.addEventListener("error", () => showToast(t("toastDecodeFailed")));
}

export async function startAudioFile(
  file: File | undefined,
  stopCurrent: () => Promise<void>
): Promise<void> {
  if (!file || sourceStore.isStarting) return;

  sourceStore.isStarting = true;
  setStatus("statusLoadingFile", "idle");

  try {
    await stopCurrent();
    sourceStore.isStarting = true;

    const context = await openSession("file");
    objectUrl = URL.createObjectURL(file);
    element = document.createElement("audio");
    element.controls = true;
    element.preload = "metadata";
    element.src = objectUrl;
    element.setAttribute("aria-label", t("localAudioAria", { name: file.name }));
    hostContainer?.replaceChildren(element);

    connectSource(context.createMediaElementSource(element));
    sourceStore.mode = "file";
    trackPlaybackStatus(element);

    setSourceInfo("localFile", { name: file.name });
    startAnalysis();

    try {
      await element.play();
    } catch (_) {
      // Autoplay is blocked until the user presses play — not an error.
      setStatus("statusAwaitPlay", "idle");
      showToast(t("toastFileLoaded"));
    }
  } catch (error) {
    console.error(error);
    await stopCurrent();
    sourceStore.mode = "idle";
    setStatus("statusLoadFailed", "error");
    const message = t("toastFileFailed", {
      message: error instanceof Error && error.message ? error.message : t("unknownError")
    });
    setSourceInfoRaw(message);
    showToast(message);
  } finally {
    sourceStore.isStarting = false;
  }
}
