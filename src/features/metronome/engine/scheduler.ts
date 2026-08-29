/**
 * Look-ahead scheduler (the MDN Web Audio sequencer pattern).
 *
 * A JS timer is far too jittery to play notes on. It only wakes up often
 * enough to push everything that will happen in the next `horizon` into
 * the audio clock, which then plays them sample-accurately. The clock and
 * the timer are injected, so the whole thing is unit-testable without an
 * AudioContext.
 */

import type { CursorEvent } from "./bar-cursor.js";
import type { ScheduledBeat } from "./transport.js";

export interface SchedulerClock {
  /** Audio-clock seconds. */
  now(): number;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(id: number): void;
}

export interface ScheduleSource {
  /** The next event and its gap from the previous one, without consuming it. */
  peek(): CursorEvent | null;
  /** Consume the peeked event. */
  advance(): void;
}

export interface SchedulerOptions {
  clock: SchedulerClock;
  source: ScheduleSource;
  onEvent(beat: ScheduledBeat, silent: boolean): void;
  /** How far ahead to schedule, in seconds. */
  horizon?: number;
  /** How often the timer wakes up, in milliseconds. */
  intervalMs?: number;
}

export interface Scheduler {
  readonly running: boolean;
  start(atTime?: number): void;
  stop(): void;
  /** The most recent beat at or before `time`. */
  currentAt(time: number): ScheduledBeat | null;
}

export const DEFAULT_HORIZON = 0.1;
export const DEFAULT_INTERVAL_MS = 25;

export function createScheduler(options: SchedulerOptions): Scheduler {
  const { clock, source, onEvent } = options;
  const horizon = options.horizon ?? DEFAULT_HORIZON;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  let running = false;
  let timerId = 0;
  /** Audio-clock time of the last event handed to the output. */
  let lastTime = 0;
  /** Beats already scheduled, kept so the UI can follow the audio clock. */
  let queue: ScheduledBeat[] = [];

  function pump(): void {
    const limit = clock.now() + horizon;
    // One event at a time, and the source is only asked for an event once
    // the previous one is inside the horizon. That is what keeps an edit
    // from waiting: at most one event is already committed to the clock.
    while (running) {
      const item = source.peek();
      if (!item) break;
      const time = lastTime + item.delta;
      // Nothing beyond the horizon is committed: it stays in the cursor
      // and is recomputed at the next tick, at whatever the tempo is then.
      if (time >= limit) break;
      source.advance();
      lastTime = time;
      const beat: ScheduledBeat = {
        event: item.event,
        time,
        barIndex: item.barIndex
      };
      queue.push(beat);
      onEvent(beat, item.silent);
    }

    // Drop beats that are well in the past; the UI never looks that far back.
    const cutoff = clock.now() - 1;
    if (queue.length > 256) queue = queue.filter((beat) => beat.time >= cutoff);
  }

  function tick(): void {
    if (!running) return;
    pump();
    timerId = clock.setTimer(tick, intervalMs);
  }

  return {
    get running() {
      return running;
    },
    start(atTime?: number) {
      if (running) return;
      running = true;
      queue = [];
      lastTime = atTime ?? clock.now();
      tick();
    },
    stop() {
      if (!running) return;
      running = false;
      clock.clearTimer(timerId);
      timerId = 0;
    },
    currentAt(time: number) {
      let current: ScheduledBeat | null = null;
      for (const beat of queue) {
        if (beat.time > time + 1e-6) break;
        current = beat;
      }
      return current;
    }
  };
}
