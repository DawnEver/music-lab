/**
 * Shared audio session store (ported from the legacy app.js controller).
 *
 * The reactive surface holds everything UI binds to (mode, status, source
 * info, settings, and devices). The audio graph itself (context,
 * analyser, stream, buffers) stays in non-reactive module state — it is
 * touched only by the actions below and by the analysis loop.
 */
import { clamp } from "../../../lib/dsp.js";
import { t } from "../../../composables/useI18n.js";
import { acquireAudio } from "../../../audio/audio-engine.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { showToast } from "../../../shared/stores/toast.js";
export { showToast, toastMessage, toastVisible } from "../../../shared/stores/toast.js";
import {
  FFT_SIZE,
  startAnalysisLoop,
  stopAnalysisLoop,
  type AnalysisLoopParams
} from "../../../lib/analysis-loop.js";

export { audioStore, type AudioDevice, type SourceMode } from "./audio-state.js";
import { audioStore } from "./audio-state.js";
// --- Non-reactive audio graph internals ---

let lease: AudioEngineHandle | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: AudioNode | null = null;
let outputGain: GainNode | null = null;
let stream: MediaStream | null = null;
let audioElement: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let hostContainer: HTMLElement | null = null;

/** Container that receives the <audio> element in file mode. */
export function setAudioHostContainer(el: HTMLElement | null): void {
  hostContainer = el;
}

function setStatus(key: string, mode: "idle" | "live" | "error"): void {
  audioStore.statusKey = key;
  audioStore.statusMode = mode;
}

function setSourceInfo(key: string, params: Record<string, string> = {}): void {
  audioStore.sourceInfoKey = key;
  audioStore.sourceInfoParams = params;
  audioStore.sourceInfoOverride = "";
}

function setSourceInfoRaw(text: string): void {
  audioStore.sourceInfoOverride = text;
}

export function updateSettings(tuning: number, gateDb: number, stability: number): void {
  audioStore.tuning = tuning;
  audioStore.gateDb = gateDb;
  audioStore.stability = stability;

  if (analyser) {
    analyser.smoothingTimeConstant = clamp(stability, 0.2, 0.92);
  }
}

async function createAudioGraph(mode: "mic" | "file"): Promise<void> {
  try {
    lease = await acquireAudio();
  } catch (_) {
    throw new Error(t("errWebAudio"));
  }
  ctx = lease.context;

  analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = clamp(audioStore.stability, 0.2, 0.92);

  // Monitoring gain: silent for the mic (no feedback loop), audible for
  // file playback. It joins the shared master bus, not `destination`.
  outputGain = ctx.createGain();
  outputGain.gain.value = mode === "mic" ? 0 : 0.92;
  analyser.connect(outputGain);
  outputGain.connect(lease.master);

  audioStore.sampleRate = ctx.sampleRate;
}

export { populateDevices } from "./device-discovery.js";
import { populateDevices } from "./device-discovery.js";

export async function startMicrophone(): Promise<void> {
  if (audioStore.isStarting) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast(t("toastMicSecure"));
    setStatus("statusMicUnavailable", "error");
    return;
  }

  audioStore.isStarting = true;
  setStatus("statusRequesting", "idle");

  try {
    await stopAudio(false);
    audioStore.isStarting = true;

    const selectedDeviceId = audioStore.deviceId;
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    };

    if (selectedDeviceId) {
      audioConstraints.deviceId = { exact: selectedDeviceId };
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false
    });

    await createAudioGraph("mic");
    sourceNode = ctx!.createMediaStreamSource(stream);
    sourceNode.connect(analyser!);
    audioStore.mode = "mic";

    const activeTrack = stream.getAudioTracks()[0];
    const label = activeTrack && activeTrack.label ? activeTrack.label : t("defaultMic");
    setSourceInfo("analyzing", { label });
    setStatus("statusMicLive", "live");
    beginAnalysis();
    await populateDevices();
  } catch (error) {
    console.error(error);
    await stopAudio(false);
    audioStore.mode = "idle";
    setStatus("statusStartFailed", "error");

    const unknown = t("unknownError");
    const message =
      error instanceof Error && error.name === "NotAllowedError"
        ? t("toastMicDenied")
        : error instanceof Error && error.name === "NotFoundError"
          ? t("toastNoMic")
          : t("toastMicStartFailed", {
              message: error instanceof Error && error.message ? error.message : unknown
            });

    showToast(message);
    setSourceInfoRaw(message);
  } finally {
    audioStore.isStarting = false;
  }
}

export async function startAudioFile(file: File | undefined): Promise<void> {
  if (!file || audioStore.isStarting) return;

  audioStore.isStarting = true;
  setStatus("statusLoadingFile", "idle");

  try {
    await stopAudio(false);
    audioStore.isStarting = true;

    await createAudioGraph("file");
    objectUrl = URL.createObjectURL(file);
    audioElement = document.createElement("audio");
    audioElement.controls = true;
    audioElement.preload = "metadata";
    audioElement.src = objectUrl;
    audioElement.setAttribute("aria-label", t("localAudioAria", { name: file.name }));
    if (hostContainer) {
      hostContainer.replaceChildren(audioElement);
    }

    sourceNode = ctx!.createMediaElementSource(audioElement);
    sourceNode.connect(analyser!);
    audioStore.mode = "file";

    audioElement.addEventListener("play", async () => {
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
      setStatus("statusFilePlaying", "live");
    });

    audioElement.addEventListener("pause", () => {
      if (audioStore.mode === "file") setStatus("statusFilePaused", "idle");
    });

    audioElement.addEventListener("ended", () => {
      if (audioStore.mode === "file") setStatus("statusFileEnded", "idle");
    });

    audioElement.addEventListener("error", () => {
      showToast(t("toastDecodeFailed"));
    });

    setSourceInfo("localFile", { name: file.name });
    beginAnalysis();

    try {
      await audioElement.play();
    } catch (_) {
      setStatus("statusAwaitPlay", "idle");
      showToast(t("toastFileLoaded"));
    }
  } catch (error) {
    console.error(error);
    await stopAudio(false);
    audioStore.mode = "idle";
    setStatus("statusLoadFailed", "error");
    const message = t("toastFileFailed", {
      message: error instanceof Error && error.message ? error.message : t("unknownError")
    });
    setSourceInfoRaw(message);
    showToast(message);
  } finally {
    audioStore.isStarting = false;
  }
}

async function stopAudio(resetUi = true): Promise<void> {
  stopAnalysisLoop();

  if (audioElement) {
    audioElement.pause();
    audioElement.removeAttribute("src");
    audioElement.load();
    audioElement = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  for (const node of [sourceNode, analyser, outputGain]) {
    try {
      if (node) node.disconnect();
    } catch (_) {
      // Node may already be disconnected.
    }
  }

  sourceNode = null;
  analyser = null;
  outputGain = null;

  // The context belongs to the engine: drop the lease instead of closing
  // it, so a metronome running alongside the tuner keeps its clock.
  if (lease) {
    lease.release();
    lease = null;
  }
  ctx = null;

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  if (hostContainer) {
    hostContainer.replaceChildren();
  }
  audioStore.mode = "idle";

  if (resetUi) {
    setStatus("statusIdle", "idle");
    setSourceInfo("sourceInfoDefault");
  }
}

function beginAnalysis(): void {
  if (!analyser || !ctx) return;
  const params: AnalysisLoopParams = {
    analyser,
    sampleRate: ctx.sampleRate,
    getTuning: () => audioStore.tuning,
    getGateDb: () => audioStore.gateDb,
    getStability: () => audioStore.stability
  };
  startAnalysisLoop(params);
}

export async function stop(): Promise<void> {
  await stopAudio(true);
}

/** Best-effort teardown for beforeunload. */
export function cleanup(): void {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}
