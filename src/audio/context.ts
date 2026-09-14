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
  limiter: DynamicsCompressorNode;
  leases: number;
}

let engine: Engine | null = null;

/**
 * The last thing between the app and the speakers.
 *
 * A voice is calibrated so that one note of it sits at a loudness, which
 * puts a single note around -8dBFS — and a player does not play one note.
 * Measured through this engine, a five-note chord already peaks at the
 * ceiling and ten notes ask for three decibels more than exists, which a
 * sound card answers by flattening the peaks: the crunch that makes a
 * chord sound broken rather than loud.
 *
 * A limiter rather than turning everything down, because turning
 * everything down is a change to the sound of every note ever played,
 * including the nine tenths of them that were never a problem. This does
 * nothing below its threshold. Above it, the peaks are brought down
 * instead of cut off, which is what a chord should sound like: louder,
 * not distorted.
 */
function limiterFor(context: AudioContext): DynamicsCompressorNode {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  return limiter;
}

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
    const limiter = limiterFor(context);
    master.connect(limiter);
    limiter.connect(context.destination);
    engine = { context, master, limiter, leases: 0 };
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
    target.limiter.disconnect();
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

/**
 * The output limiter, without taking a lease.
 *
 * Alongside `peekContext` for the same reason: what the engine is doing to
 * the sound is otherwise only observable by listening to it. `reduction`
 * is how much the limiter is taking off at this instant, which is how a
 * test can tell that a chord is being held down rather than cut off.
 */
export function peekLimiter(): DynamicsCompressorNode | null {
  return engine ? engine.limiter : null;
}

/** Number of live leases — used by tests and diagnostics. */
export function leaseCount(): number {
  return engine ? engine.leases : 0;
}
