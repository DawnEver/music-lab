/**
 * Transport contract and its native implementation.
 *
 * A transport turns a stream of timed events into sound on the audio clock.
 * Features depend on this interface, never on the Web Audio implementation,
 * so a Tone.js transport can replace it without touching a feature — and so
 * the metronome, ear training and playback share one clock discipline
 * instead of each growing a scheduler.
 */

import { acquireAudio } from "./context.js";
import type { AudioEngineHandle } from "./types.js";
import {
  createScheduler,
  type ScheduleSource,
  type Scheduled,
  type Scheduler,
  type TimedEvent
} from "./scheduler.js";

export interface Transport<T extends TimedEvent> {
  readonly running: boolean;
  start(): Promise<void>;
  stop(): void;
  /** Audio-clock now, or 0 when nothing is running. */
  now(): number;
  /** The event sounding at `time` — the UI polls this from rAF. */
  currentAt(time: number): Scheduled<T> | null;
  dispose(): void;
}

export interface NativeTransportOptions<T extends TimedEvent> {
  /** Built once per start, over the live context. */
  createSource(context: AudioContext): ScheduleSource<T>;
  /** Sound an event. Silent events never reach here. */
  play(event: Scheduled<T>, context: AudioContext): void;
  /** Build per-start output nodes (voices, gains) before the first event. */
  onStart?(handle: AudioEngineHandle): void;
  /** Tear those down. */
  onStop?(): void;
  /** Notified for every scheduled event, sounded or not. */
  onSchedule?(event: Scheduled<T>, silent: boolean): void;
  /** Seconds of head start, so the first event is never late. */
  lead?: number;
}

export function createNativeTransport<T extends TimedEvent>(
  options: NativeTransportOptions<T>
): Transport<T> {
  let lease: AudioEngineHandle | null = null;
  let scheduler: Scheduler<T> | null = null;
  let running = false;

  return {
    get running() {
      return running;
    },
    async start() {
      if (running) return;
      lease = await acquireAudio();
      const context = lease.context;
      options.onStart?.(lease);
      scheduler = createScheduler<T>({
        clock: {
          now: () => context.currentTime,
          setTimer: (callback, ms) => window.setTimeout(callback, ms),
          clearTimer: (id) => window.clearTimeout(id)
        },
        source: options.createSource(context),
        onEvent(event, silent) {
          if (!silent) options.play(event, context);
          options.onSchedule?.(event, silent);
        }
      });
      running = true;
      scheduler.start(context.currentTime + (options.lead ?? 0.06));
    },
    stop() {
      running = false;
      scheduler?.stop();
      scheduler = null;
      options.onStop?.();
      lease?.release();
      lease = null;
    },
    now() {
      return lease ? lease.context.currentTime : 0;
    },
    currentAt(time: number) {
      return scheduler ? scheduler.currentAt(time) : null;
    },
    dispose() {
      this.stop();
    }
  };
}
