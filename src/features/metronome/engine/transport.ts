/**
 * Transport contract. Business code (the store, the UI) only ever sees
 * this interface, so the native Web Audio implementation can be swapped
 * for a Tone.js one later without touching a feature.
 */

import type { BeatEvent } from "../domain/rhythm.js";

export interface ScheduledBeat {
  event: BeatEvent;
  /** Absolute audio-clock time in seconds. */
  time: number;
  barIndex: number;
}

/** Runtime knobs a click-based transport also exposes. */
export interface ClickTransport extends Transport {
  setBank(id: string): void;
  setVolume(value: number): void;
}

export interface Transport {
  readonly running: boolean;
  start(): Promise<void>;
  stop(): void;
  /** Audio-clock now, or 0 when nothing is running. */
  now(): number;
  /** The beat sounding at `time` — the UI polls this from rAF. */
  currentAt(time: number): ScheduledBeat | null;
  dispose(): void;
}
