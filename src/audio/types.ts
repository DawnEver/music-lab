/**
 * Shared audio-layer contracts. Everything above this layer (tuner,
 * metronome, future drum machine) talks in these terms and never creates
 * an AudioContext of its own.
 */

export interface AudioEngineHandle {
  /** The live context. Never closed while a lease is held. */
  readonly context: AudioContext;
  /** Every tool's output goes here, never straight to `destination`. */
  readonly master: GainNode;
  /** Release this lease; the context closes when the last one goes. */
  release(): void;
}

/** Audio-clock seconds, i.e. `AudioContext.currentTime`. */
export type AudioTime = number;
