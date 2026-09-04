/**
 * Look-ahead scheduler (the MDN Web Audio sequencer pattern).
 *
 * A JS timer is far too jittery to play notes on. It only wakes up often
 * enough to push everything that will happen in the next `horizon` into the
 * audio clock, which then plays them sample-accurately. The clock and the
 * timer are injected, so the whole thing is unit-testable without an
 * AudioContext.
 *
 * It is generic over the event: it reads only `delta` and `silent`, so a
 * metronome bar, an ear-training exercise and a playback take can all be
 * scheduled by the same code without any of them being privileged.
 */

/** The minimum an event must carry: its gap from the previous one. */
export interface TimedEvent {
  /** Seconds since the previous event. */
  delta: number;
  /** Scheduled, counted and reported, but not sounded. */
  silent?: boolean;
}

/** An event placed on the audio clock. */
export type Scheduled<T extends TimedEvent> = T & { time: number };

export interface SchedulerClock {
  /** Audio-clock seconds. */
  now(): number;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(id: number): void;
}

export interface ScheduleSource<T extends TimedEvent> {
  /** The next event and its gap from the previous one, without consuming it. */
  peek(): T | null;
  /** Consume the peeked event. */
  advance(): void;
}

export interface SchedulerOptions<T extends TimedEvent> {
  clock: SchedulerClock;
  source: ScheduleSource<T>;
  onEvent(event: Scheduled<T>, silent: boolean): void;
  /** How far ahead to schedule, in seconds. */
  horizon?: number;
  /** How often the timer wakes up, in milliseconds. */
  intervalMs?: number;
}

export interface Scheduler<T extends TimedEvent> {
  readonly running: boolean;
  start(atTime?: number): void;
  stop(): void;
  /** The most recent event at or before `time`. */
  currentAt(time: number): Scheduled<T> | null;
}

export const DEFAULT_HORIZON = 0.1;
export const DEFAULT_INTERVAL_MS = 25;

export function createScheduler<T extends TimedEvent>(
  options: SchedulerOptions<T>
): Scheduler<T> {
  const { clock, source, onEvent } = options;
  const horizon = options.horizon ?? DEFAULT_HORIZON;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  let running = false;
  let timerId = 0;
  /** Audio-clock time of the last event handed to the output. */
  let lastTime = 0;
  /** Events already scheduled, kept so the UI can follow the audio clock. */
  let queue: Scheduled<T>[] = [];

  function pump(): void {
    const limit = clock.now() + horizon;
    // One event at a time, and the source is only asked for an event once
    // the previous one is inside the horizon. That is what keeps an edit
    // from waiting: at most one event is already committed to the clock.
    while (running) {
      const item = source.peek();
      if (!item) break;
      const time = lastTime + item.delta;
      // Nothing beyond the horizon is committed: it stays in the source and
      // is recomputed at the next tick, at whatever the tempo is then.
      if (time >= limit) break;
      source.advance();
      lastTime = time;
      const scheduled = { ...item, time } as Scheduled<T>;
      queue.push(scheduled);
      onEvent(scheduled, item.silent ?? false);
    }

    // Drop events well in the past; the UI never looks that far back.
    const cutoff = clock.now() - 1;
    if (queue.length > 256) queue = queue.filter((event) => event.time >= cutoff);
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
      let current: Scheduled<T> | null = null;
      for (const event of queue) {
        if (event.time > time + 1e-6) break;
        current = event;
      }
      return current;
    }
  };
}
