import { describe, expect, it } from "vitest";
import { createBarCursor } from "../src/features/metronome/engine/bar-cursor.js";
import { makeMeter } from "../src/features/metronome/domain/meter.js";
import { defaultAccents } from "../src/features/metronome/domain/accent.js";
import type { RhythmPattern } from "../src/features/metronome/domain/rhythm.js";

function pattern(pulses: number, divisions = 1): RhythmPattern {
  const meter = makeMeter(4, Array.from({ length: pulses }, () => 1));
  return { meter, accents: defaultAccents(meter), subdivision: { divisions } };
}

/** A cursor over a pattern that the test can mutate between events. */
function cursorOver(live: () => RhythmPattern, pulseSeconds: () => number, silent = () => false) {
  return createBarCursor({
    startBar: () => ({ meter: live().meter, silent: silent() }),
    pattern: live,
    pulseSeconds
  });
}

/** Pull `count` events and return their deltas in seconds. */
function pull(cursor: ReturnType<typeof createBarCursor>, count: number) {
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const item = cursor.next();
    if (!item) break;
    out.push(item);
  }
  return out;
}

describe("bar cursor", () => {
  it("spaces a 4/4 bar evenly and carries across the bar line", () => {
    const cursor = cursorOver(() => pattern(4), () => 0.5);
    const events = pull(cursor, 6);
    expect(events.map((event) => event.delta)).toEqual([0, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(events.map((event) => event.barIndex)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it("applies a tempo change to the very next event, not the next bar", () => {
    let pulse = 0.5;
    const cursor = cursorOver(() => pattern(4), () => pulse);
    pull(cursor, 2);
    // The user drags the tempo in the middle of the bar.
    pulse = 0.25;
    expect(cursor.next()?.delta).toBeCloseTo(0.25, 12);
    expect(cursor.next()?.delta).toBeCloseTo(0.25, 12);
  });

  it("applies a subdivision change from the next event inside the same bar", () => {
    let divisions = 1;
    const cursor = cursorOver(() => pattern(4, divisions), () => 0.5);
    pull(cursor, 1);
    divisions = 2;
    // Halfway through beat 1 comes the new eighth, then beat 2.
    const next = cursor.next();
    expect(next?.delta).toBeCloseTo(0.25, 12);
    expect(next?.event.accent).toBe("subdivision");
    expect(cursor.next()?.delta).toBeCloseTo(0.25, 12);
  });

  it("holds a meter change until the bar line", () => {
    let pulses = 4;
    const cursor = cursorOver(() => pattern(pulses), () => 0.5);
    pull(cursor, 1);
    // Switching to 3/4 mid-bar must not shorten the bar being played.
    pulses = 3;
    const rest = pull(cursor, 6);
    expect(rest.map((event) => event.barIndex)).toEqual([0, 0, 0, 1, 1, 1]);
    // Bar 0 keeps its four beats; bar 1 is the first three-beat bar.
    expect(rest[3].delta).toBeCloseTo(0.5, 12);
  });

  it("opens each bar exactly once, so practice mode rolls its dice per bar", () => {
    const asked: number[] = [];
    const cursor = createBarCursor({
      startBar: (barIndex) => {
        asked.push(barIndex);
        return { meter: pattern(2).meter, silent: false };
      },
      pattern: () => pattern(2, 4),
      pulseSeconds: () => 0.5
    });
    pull(cursor, 8);
    expect(asked).toEqual([0]);
    pull(cursor, 1);
    expect(asked).toEqual([0, 1]);
  });

  it("skips a fully muted bar and keeps the beat grid aligned", () => {
    let muted = false;
    const cursor = createBarCursor({
      startBar: (barIndex) => {
        // Only bar 1 is silenced by muting every one of its beats.
        muted = barIndex === 1;
        return { meter: pattern(2).meter, silent: false };
      },
      pattern: () => {
        const base = pattern(2);
        return muted ? { ...base, accents: ["mute", "mute"] } : base;
      },
      pulseSeconds: () => 0.5
    });
    pull(cursor, 2);
    // Bar 1 is silent; the next audible event is bar 2's downbeat, a full
    // bar plus the remaining beat later.
    const next = cursor.next();
    expect(next?.barIndex).toBe(2);
    expect(next?.delta).toBeCloseTo(1.5, 12);
  });

  it("passes the practice-mode silent flag through per bar", () => {
    let silent = false;
    const cursor = cursorOver(() => pattern(1), () => 0.5, () => silent);
    expect(cursor.next()?.silent).toBe(false);
    silent = true;
    expect(cursor.next()?.silent).toBe(true);
  });
});
