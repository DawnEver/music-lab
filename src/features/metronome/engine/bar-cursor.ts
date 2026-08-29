/**
 * Walks a pattern one event at a time.
 *
 * The scheduler used to compile a whole bar with a frozen tempo, so every
 * edit — tempo, subdivision, swing, accents — waited for the next bar
 * line. Here the pattern is re-read for every event instead:
 *
 *   tempo / subdivision / swing / accents / polyrhythm -> the next event
 *   meter (bar length)                                 -> the next bar line
 *
 * A bar's meter is locked when the bar opens, because changing the length
 * of a bar half way through would destroy the count. Everything else is
 * live. Positions are kept in pulse units and turned into seconds with the
 * current pulse length at the moment the event is scheduled.
 *
 * `peek()` is pure: it reports the next event without consuming it, so the
 * scheduler can leave anything beyond its horizon uncommitted and
 * recompute it later at the new tempo. `advance()` consumes it.
 */

import { compileBar, type BeatEvent, type RhythmPattern } from "../domain/rhythm.js";
import { meterPulses, type Meter } from "../domain/meter.js";

export interface BarPlan {
  /** The bar's length is fixed for its duration. */
  meter: Meter;
  /** Whole-bar mute (practice mode); the events still count. */
  silent: boolean;
}

export interface BarCursorOptions {
  /**
   * Called once per bar index, at its bar line. Practice mode picks the
   * bar's tempo and whether it is silent here, so its dice are rolled once
   * per bar rather than once per event.
   */
  startBar(barIndex: number): BarPlan;
  /** Live accents / subdivision / swing / polyrhythm; read per event. */
  pattern(): RhythmPattern;
  /**
   * Live length of one meter pulse in seconds. The bar's own meter is
   * passed in so a denominator change cannot stretch the bar already
   * playing.
   */
  pulseSeconds(meter: Meter): number;
}

export interface CursorEvent {
  event: BeatEvent;
  /** Seconds from the previous event (0 for the very first). */
  delta: number;
  barIndex: number;
  silent: boolean;
}

export interface BarCursor {
  /** The next event, recomputed live, without consuming it. */
  peek(): CursorEvent | null;
  /** Consume the event `peek()` reported. */
  advance(): void;
  /** peek + advance, for callers that always take the event. */
  next(): CursorEvent | null;
}

interface CursorState {
  barIndex: number;
  meter: Meter | null;
  barPulses: number;
  /** Pulse position of the last emitted event inside its bar. */
  lastPulse: number;
  emitted: boolean;
  /** Pulses between the last emitted event and the current bar's start. */
  carry: number;
}

const EPSILON = 1e-9;
/** Bars that make no sound at all still advance; this caps the search. */
const MAX_EMPTY_BARS = 64;

export function createBarCursor(options: BarCursorOptions): BarCursor {
  let state: CursorState = {
    barIndex: -1,
    meter: null,
    barPulses: 0,
    lastPulse: 0,
    emitted: false,
    carry: 0
  };

  // Memoized per bar so peek() and advance() see the same plan and
  // practice mode never rolls twice for one bar.
  const plans = new Map<number, BarPlan>();

  function planFor(barIndex: number): BarPlan {
    let plan = plans.get(barIndex);
    if (!plan) {
      plan = options.startBar(barIndex);
      plans.set(barIndex, plan);
      for (const key of plans.keys()) {
        if (key < barIndex - 2) plans.delete(key);
      }
    }
    return plan;
  }

  function openBar(from: CursorState): CursorState {
    const barIndex = from.barIndex + 1;
    const plan = planFor(barIndex);
    return {
      barIndex,
      meter: plan.meter,
      barPulses: meterPulses(plan.meter),
      lastPulse: 0,
      emitted: false,
      carry: from.carry
    };
  }

  function compute(): { result: CursorEvent; state: CursorState } | null {
    let cursor = state.meter ? state : openBar(state);

    for (let guard = 0; guard <= MAX_EMPTY_BARS; guard += 1) {
      const meter = cursor.meter as Meter;
      const events = compileBar({ ...options.pattern(), meter }, 1);
      const from = cursor.emitted ? cursor.lastPulse : 0;
      const event = events.find((candidate) =>
        cursor.emitted ? candidate.time > from + EPSILON : candidate.time >= -EPSILON
      );

      if (event) {
        return {
          result: {
            event,
            delta: (cursor.carry + event.time - from) * options.pulseSeconds(meter),
            barIndex: cursor.barIndex,
            silent: planFor(cursor.barIndex).silent
          },
          state: { ...cursor, carry: 0, lastPulse: event.time, emitted: true }
        };
      }

      // Bar exhausted (or entirely muted): carry its tail into the next.
      cursor = openBar({ ...cursor, carry: cursor.carry + cursor.barPulses - from });
    }

    return null;
  }

  return {
    peek() {
      return compute()?.result ?? null;
    },
    advance() {
      const computed = compute();
      if (computed) state = computed.state;
    },
    next() {
      const computed = compute();
      if (!computed) return null;
      state = computed.state;
      return computed.result;
    }
  };
}
