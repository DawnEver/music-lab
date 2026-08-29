/**
 * Look-ahead scheduler (the MDN Web Audio sequencer pattern).
 *
 * A JS timer is far too jittery to play notes on. It only wakes up often
 * enough to push everything that will happen in the next `horizon` into
 * the audio clock, which then plays them sample-accurately. The clock and
 * the timer are injected, so the whole thing is unit-testable without an
 * AudioContext.
 */

import type { BeatEvent } from "../domain/rhythm.js";
import type { ScheduledBeat } from "./transport.js";

export interface SchedulerClock {
  /** Audio-clock seconds. */
  now(): number;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(id: number): void;
}

export interface BarSource {
  /** Compile bar `barIndex`; `duration` is its length in seconds. */
  nextBar(barIndex: number): { events: BeatEvent[]; duration: number };
}

export interface SchedulerOptions {
  clock: SchedulerClock;
  source: BarSource;
  onEvent(beat: ScheduledBeat): void;
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
  let barIndex = 0;
  let nextBarTime = 0;
  /** Beats already handed to the audio clock, kept for the UI to follow. */
  let queue: ScheduledBeat[] = [];

  /** Beats compiled but not yet handed to the audio clock. */
  let buffer: ScheduledBeat[] = [];

  function fillBar(): void {
    const bar = source.nextBar(barIndex);
    buffer = bar.events.map((event) => ({
      event,
      time: nextBarTime + event.time,
      barIndex
    }));
    nextBarTime += Math.max(bar.duration, 1e-3);
    barIndex += 1;
  }

  function pump(): void {
    const limit = clock.now() + horizon;
    // Emit beat by beat, not bar by bar: a bar is often longer than the
    // horizon, and a per-bar granularity would freeze tempo changes and
    // delay stops by a whole bar.
    while (running) {
      if (!buffer.length) fillBar();
      const next = buffer[0];
      if (!next || next.time >= limit) break;
      buffer.shift();
      queue.push(next);
      onEvent(next);
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
      barIndex = 0;
      queue = [];
      buffer = [];
      nextBarTime = atTime ?? clock.now();
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
