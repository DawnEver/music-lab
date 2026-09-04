/**
 * The metronome's transport: the shared native transport, with a click
 * engine as its output and the bar cursor as its event source.
 *
 * Audio is the master clock. Nothing here reads Vue state at beat time —
 * the pattern is pulled through `pattern()` once per event.
 */

import { createNativeTransport, type Transport } from "../../../audio/transport.js";
import type { Scheduled } from "../../../audio/scheduler.js";
import type { RhythmPattern } from "../domain/rhythm.js";
import type { Meter } from "../domain/meter.js";
import { createBarCursor, type BarPlan, type CursorEvent } from "./bar-cursor.js";
import { createClickEngine, type ClickEngine } from "./click-engine.js";

/** A beat placed on the audio clock. */
export type ScheduledBeat = Scheduled<CursorEvent>;

/** The transport plus the click-specific knobs. */
export interface ClickTransport extends Transport<CursorEvent> {
  setBank(id: string): void;
  setVolume(value: number): void;
}

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

export function createMetronomeTransport(options: NativeTransportOptions): ClickTransport {
  let clicks: ClickEngine | null = null;
  let bankId = options.bankId ?? "synth";
  let volume = options.volume ?? 0.8;

  const transport = createNativeTransport<CursorEvent>({
    createSource: () =>
      createBarCursor({
        startBar: options.startBar,
        pattern: options.pattern,
        pulseSeconds: options.pulseSeconds
      }),
    onStart(handle) {
      clicks = createClickEngine(handle.context, handle.master, bankId);
      clicks.setVolume(volume);
    },
    onStop() {
      clicks?.dispose();
      clicks = null;
    },
    play(beat) {
      clicks?.play(beat.event.accent, beat.time, beat.event.voice);
    },
    onSchedule: options.onSchedule
  });

  return {
    ...transport,
    get running() {
      return transport.running;
    },
    setBank(id: string) {
      bankId = id;
      clicks?.setBank(id);
    },
    setVolume(value: number) {
      volume = value;
      clicks?.setVolume(value);
    }
  };
}
