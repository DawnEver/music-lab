/**
 * Native Web Audio implementation of `Transport`: the shared AudioContext
 * as the clock, a look-ahead scheduler feeding the click engine.
 *
 * Audio is the master clock. Nothing here reads Vue state at beat time —
 * the pattern is pulled through `getPattern()` once per bar.
 */

import { acquireAudio } from "../../../audio/audio-engine.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import type { RhythmPattern } from "../domain/rhythm.js";
import type { Meter } from "../domain/meter.js";
import { createBarCursor, type BarPlan } from "./bar-cursor.js";
import { createClickEngine, type ClickEngine } from "./click-engine.js";
import { createScheduler, type Scheduler } from "./scheduler.js";
import type { ClickTransport, ScheduledBeat } from "./transport.js";

export interface NativeTransportOptions {
  /** Once per bar: locks the bar's meter and applies practice mode. */
  startBar(barIndex: number): BarPlan;
  /** Live pattern; read per event so edits land on the next click. */
  pattern(): RhythmPattern;
  /** Live pulse length for the given bar meter; read per event. */
  pulseSeconds(meter: Meter): number;
  /** Notified for every scheduled beat, for the beat-grid display. */
  onSchedule?(beat: ScheduledBeat, silent: boolean): void;
  bankId?: string;
  volume?: number;
}

export function createNativeTransport(options: NativeTransportOptions): ClickTransport {
  let lease: AudioEngineHandle | null = null;
  let clicks: ClickEngine | null = null;
  let scheduler: Scheduler | null = null;
  let running = false;
  let bankId = options.bankId ?? "synth";
  let volume = options.volume ?? 0.8;

  function buildScheduler(context: AudioContext): Scheduler {
    const cursor = createBarCursor({
      startBar: options.startBar,
      pattern: options.pattern,
      pulseSeconds: options.pulseSeconds
    });

    return createScheduler({
      clock: {
        now: () => context.currentTime,
        setTimer: (callback, ms) => window.setTimeout(callback, ms),
        clearTimer: (id) => window.clearTimeout(id)
      },
      source: cursor,
      onEvent(beat, silent) {
        if (!silent) clicks?.play(beat.event.accent, beat.time, beat.event.voice);
        options.onSchedule?.(beat, silent);
      }
    });
  }

  return {
    get running() {
      return running;
    },
    async start() {
      if (running) return;
      lease = await acquireAudio();
      clicks = createClickEngine(lease.context, lease.master, bankId);
      clicks.setVolume(volume);
      scheduler = buildScheduler(lease.context);
      running = true;
      // Start a hair in the future so the first beat is never late.
      scheduler.start(lease.context.currentTime + 0.06);
    },
    stop() {
      running = false;
      scheduler?.stop();
      scheduler = null;
      clicks?.dispose();
      clicks = null;
      lease?.release();
      lease = null;
    },
    now() {
      return lease ? lease.context.currentTime : 0;
    },
    currentAt(time: number) {
      return scheduler ? scheduler.currentAt(time) : null;
    },
    setBank(id: string) {
      bankId = id;
      clicks?.setBank(id);
    },
    setVolume(value: number) {
      volume = value;
      clicks?.setVolume(value);
    },
    dispose() {
      this.stop();
    }
  };
}
