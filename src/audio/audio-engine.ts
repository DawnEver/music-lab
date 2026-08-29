/**
 * The single AudioContext for the whole app.
 *
 * Tools acquire a lease instead of constructing a context: the tuner needs
 * mic -> analyser, the metronome needs click -> output, and both must be
 * able to run at the same time. The context is created on first acquire
 * and closed only when the last lease is released, so the lifetime belongs
 * to the engine rather than to any one feature.
 */

import type { AudioEngineHandle } from "./types.js";

interface Engine {
  context: AudioContext;
  master: GainNode;
  leases: number;
}

let engine: Engine | null = null;

function createContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("WEB_AUDIO_UNAVAILABLE");
  }
  return new AudioContextClass({ latencyHint: "interactive" });
}

/**
 * Acquire a lease on the shared context, resuming it (browsers start it
 * suspended until a user gesture).
 */
export async function acquireAudio(): Promise<AudioEngineHandle> {
  if (!engine || engine.context.state === "closed") {
    const context = createContext();
    const master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);
    engine = { context, master, leases: 0 };
  }

  const current = engine;
  current.leases += 1;

  if (current.context.state === "suspended") {
    try {
      await current.context.resume();
    } catch (_) {
      // A resume before the first gesture can reject; the next one wins.
    }
  }

  let released = false;
  return {
    context: current.context,
    master: current.master,
    release() {
      if (released) return;
      released = true;
      current.leases -= 1;
      if (current.leases <= 0) closeEngine(current);
    }
  };
}

function closeEngine(target: Engine): void {
  if (engine === target) engine = null;
  try {
    target.master.disconnect();
  } catch (_) {
    // Already detached.
  }
  if (target.context.state !== "closed") {
    void target.context.close().catch(() => undefined);
  }
}

/** Current context without taking a lease (null when nothing is running). */
export function peekContext(): AudioContext | null {
  return engine ? engine.context : null;
}

/** Number of live leases — used by tests and diagnostics. */
export function leaseCount(): number {
  return engine ? engine.leases : 0;
}
