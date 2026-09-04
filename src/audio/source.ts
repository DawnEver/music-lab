/**
 * The app's input session: which source is live, the graph it feeds, and
 * what the UI says about it.
 *
 * Input is application-level, not a tool's private property. A player picks
 * a microphone once and expects the whole app to be listening — the tuner,
 * the spectrogram and sight-singing are three views of one input, not three
 * separate recordings. Everything that needs frames attaches a *tap*
 * (capture.ts); taps survive source changes and are reconnected here.
 *
 * Deliberately non-reactive below the store — Vue has no business tracking
 * AudioNodes.
 */

import { reactive } from "vue";
import { acquireAudio } from "./context.js";
import type { AudioEngineHandle } from "./types.js";
import type { MessageKey } from "../lib/i18n/index.js";

export type SourceMode = "idle" | "mic" | "file";

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export const sourceStore = reactive({
  mode: "idle" as SourceMode,
  statusKey: "statusIdle" as MessageKey,
  statusMode: "idle" as "idle" | "live" | "error",
  sourceInfoKey: "sourceInfoDefault" as MessageKey,
  sourceInfoParams: {} as Record<string, string>,
  sourceInfoOverride: "",
  isStarting: false,
  deviceId: "",
  devices: [] as AudioDevice[],
  sampleRate: 0
});

export function setStatus(key: MessageKey, mode: "idle" | "live" | "error"): void {
  sourceStore.statusKey = key;
  sourceStore.statusMode = mode;
}

/** Source line rendered from the dictionary. */
export function setSourceInfo(key: MessageKey, params: Record<string, string> = {}): void {
  sourceStore.sourceInfoKey = key;
  sourceStore.sourceInfoParams = params;
  sourceStore.sourceInfoOverride = "";
}

/** Source line that is already translated (error messages). */
export function setSourceInfoRaw(text: string): void {
  sourceStore.sourceInfoOverride = text;
}

let lease: AudioEngineHandle | null = null;
let context: AudioContext | null = null;
let sourceNode: AudioNode | null = null;
let outputGain: GainNode | null = null;

/** Nodes attached by capture.ts, reconnected whenever the source changes. */
const taps = new Set<AudioNode>();
const listeners = new Set<(context: AudioContext | null) => void>();

export function audioContext(): AudioContext | null {
  return context;
}

/** Where taps connect: the live source, or null when nothing is running. */
export function sourceOutput(): AudioNode | null {
  return sourceNode;
}

/** Called on every source start and stop, so taps can rebuild. */
export function onSourceChange(listener: (context: AudioContext | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Register a node to be fed by whatever source is (or becomes) live. */
export function attachTap(node: AudioNode): void {
  taps.add(node);
  sourceNode?.connect(node);
}

export function detachTap(node: AudioNode): void {
  taps.delete(node);
  try {
    sourceNode?.disconnect(node);
  } catch (_) {
    // Not connected — the source may already be gone.
  }
}

/**
 * Open the shared context and the monitor path. Monitoring the microphone
 * would feed back, so its gain is zero; a file is meant to be heard.
 */
export async function openSession(mode: "mic" | "file"): Promise<AudioContext> {
  lease = await acquireAudio();
  context = lease.context;
  outputGain = context.createGain();
  outputGain.gain.value = mode === "mic" ? 0 : 0.92;
  outputGain.connect(lease.master);
  sourceStore.sampleRate = context.sampleRate;
  return context;
}

/** Attach the node that produces the audio, and wire every tap to it. */
export function connectSource(node: AudioNode): void {
  sourceNode = node;
  if (outputGain) node.connect(outputGain);
  for (const tap of taps) node.connect(tap);
  for (const listener of listeners) listener(context);
}

/**
 * Close the session. The context belongs to the engine, so the lease is
 * released rather than closed — a metronome running alongside keeps its
 * clock. Taps stay registered: they belong to the tools, not the session.
 */
export function closeSession(): void {
  for (const node of [sourceNode, outputGain]) {
    try {
      node?.disconnect();
    } catch (_) {
      // Already detached.
    }
  }
  sourceNode = null;
  outputGain = null;
  lease?.release();
  lease = null;
  context = null;
  for (const listener of listeners) listener(null);
}
