import { describe, expect, it } from "vitest";
import { createScheduler, type ScheduleSource } from "../src/features/metronome/engine/scheduler.js";
import { makeMeter } from "../src/features/metronome/domain/meter.js";
import { defaultAccents } from "../src/features/metronome/domain/accent.js";
import { compileBar } from "../src/features/metronome/domain/rhythm.js";
import { clickVoice, SOUND_BANKS, soundBank } from "../src/features/metronome/engine/sound-bank.js";
import { createBarCursor } from "../src/features/metronome/engine/bar-cursor.js";

/** Fake audio clock + timer so scheduling is deterministic. */
function fakeClock() {
  let time = 0;
  let pending: (() => void) | null = null;
  return {
    clock: {
      now: () => time,
      setTimer: (callback: () => void) => {
        pending = callback;
        return 1;
      },
      clearTimer: () => {
        pending = null;
      }
    },
    advance(seconds: number) {
      time += seconds;
      const callback = pending;
      pending = null;
      callback?.();
    }
  };
}

/** A steady stream of pulses, `pulse` seconds apart, in bars of `pulses`. */
function barSource(pulse: number, pulses = 4): ScheduleSource {
  const meter = makeMeter(4, Array.from({ length: pulses }, () => 1));
  const events = compileBar(
    { meter, accents: defaultAccents(meter), subdivision: { divisions: 1 } },
    1
  );
  let index = 0;
  const at = (cursor: number) => ({
    event: events[cursor % pulses],
    delta: cursor === 0 ? 0 : pulse,
    barIndex: Math.floor(cursor / pulses),
    silent: false
  });
  return {
    peek: () => at(index),
    advance: () => {
      index += 1;
    }
  };
}

describe("look-ahead scheduler", () => {
  it("schedules only what falls inside the horizon", () => {
    const { clock, advance } = fakeClock();
    const fired: number[] = [];
    const scheduler = createScheduler({
      clock,
      source: barSource(0.5),
      horizon: 0.1,
      intervalMs: 25,
      onEvent: (scheduled) => fired.push(scheduled.time)
    });

    scheduler.start();
    // Only the downbeat is within now + 100ms.
    expect(fired).toEqual([0]);

    advance(0.5);
    expect(fired).toEqual([0, 0.5]);
    advance(0.5);
    expect(fired).toEqual([0, 0.5, 1]);
    scheduler.stop();
  });

  it("keeps a 120 BPM quarter exactly 0.5s apart across a bar boundary", () => {
    const { clock, advance } = fakeClock();
    const fired: number[] = [];
    const scheduler = createScheduler({
      clock,
      source: barSource(0.5),
      horizon: 0.1,
      onEvent: (scheduled) => fired.push(scheduled.time)
    });

    scheduler.start();
    for (let step = 0; step < 9; step += 1) advance(0.5);
    scheduler.stop();

    expect(fired).toHaveLength(10);
    fired.forEach((time, index) => expect(time).toBeCloseTo(index * 0.5, 10));
  });

  it("numbers bars so practice mode can change tempo per bar", () => {
    const { clock, advance } = fakeClock();
    const bars: number[] = [];
    let index = 0;
    const source: ScheduleSource = {
      peek: () => ({
        event: { time: 0, pulse: 0, tick: 0, accent: "strong", voice: "main" },
        delta: index === 0 ? 0 : 1,
        barIndex: index,
        silent: false
      }),
      advance: () => {
        bars.push(index);
        index += 1;
      }
    };
    const scheduler = createScheduler({ clock, source, horizon: 0.1, onEvent: () => undefined });
    scheduler.start();
    for (let step = 0; step < 3; step += 1) advance(1);
    scheduler.stop();
    expect(bars).toEqual([0, 1, 2, 3]);
  });

  it("stops scheduling once stopped and restarts from bar 0", () => {
    const { clock, advance } = fakeClock();
    const fired: number[] = [];
    const scheduler = createScheduler({
      clock,
      source: barSource(0.5),
      horizon: 0.1,
      onEvent: (scheduled) => fired.push(scheduled.time)
    });
    scheduler.start();
    scheduler.stop();
    advance(1);
    expect(fired).toEqual([0]);
    expect(scheduler.running).toBe(false);
  });

  it("exposes the queue so the UI can follow the audio clock", () => {
    const { clock, advance } = fakeClock();
    const scheduler = createScheduler({ clock, source: barSource(0.5), horizon: 0.6, onEvent: () => undefined });
    scheduler.start();
    expect(scheduler.currentAt(0.0)?.event.pulse).toBe(0);
    expect(scheduler.currentAt(0.6)?.event.pulse).toBe(1);
    expect(scheduler.currentAt(-1)).toBeNull();
    advance(1);
    scheduler.stop();
  });
});

describe("scheduler + cursor", () => {
  it("re-times events that are not yet committed when the tempo changes", () => {
    const { clock, advance } = fakeClock();
    const meter = makeMeter(4, [1, 1, 1, 1]);
    let pulse = 0.5;
    const cursor = createBarCursor({
      startBar: () => ({ meter, silent: false }),
      pattern: () => ({ meter, accents: defaultAccents(meter), subdivision: { divisions: 1 } }),
      pulseSeconds: () => pulse
    });

    const fired: number[] = [];
    const scheduler = createScheduler({
      clock,
      source: cursor,
      horizon: 0.1,
      onEvent: (beat) => fired.push(beat.time)
    });

    scheduler.start();
    advance(0.5);
    expect(fired).toEqual([0, 0.5]);

    // The user halves the beat length in the middle of the bar. The next
    // click must follow the new tempo, not wait for the bar line.
    pulse = 0.25;
    advance(0.1);
    advance(0.1);
    expect(fired[2]).toBeCloseTo(0.75, 10);
    scheduler.stop();
  });

  it("keeps the bar length of the bar already playing when the meter changes", () => {
    const { clock, advance } = fakeClock();
    let meter = makeMeter(4, [1, 1, 1, 1]);
    const cursor = createBarCursor({
      startBar: () => ({ meter, silent: false }),
      pattern: () => ({ meter, accents: defaultAccents(meter), subdivision: { divisions: 1 } }),
      pulseSeconds: () => 0.5
    });

    const bars: number[] = [];
    const scheduler = createScheduler({
      clock,
      source: cursor,
      horizon: 0.1,
      onEvent: (beat) => bars.push(beat.barIndex)
    });

    scheduler.start();
    advance(0.5);
    // Switch to 2/4 after the second beat of a 4/4 bar.
    meter = makeMeter(4, [1, 1]);
    for (let step = 0; step < 6; step += 1) advance(0.5);
    scheduler.stop();

    // Bar 0 still gets its four beats; the shorter bars start after it.
    expect(bars.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(bars.slice(4, 8)).toEqual([1, 1, 2, 2]);
  });
});

describe("sound bank", () => {
  it("gives the accent a higher pitch and more gain than a weak beat", () => {
    const bank = soundBank("synth");
    expect(clickVoice(bank, "strong").frequency).toBeGreaterThan(clickVoice(bank, "weak").frequency);
    expect(clickVoice(bank, "strong").gain).toBeGreaterThan(clickVoice(bank, "weak").gain);
    expect(clickVoice(bank, "subdivision").gain).toBeLessThan(clickVoice(bank, "weak").gain);
  });

  it("every bank defines every audible accent", () => {
    for (const bank of SOUND_BANKS) {
      for (const accent of ["strong", "medium", "weak", "subdivision"] as const) {
        const voice = clickVoice(bank, accent);
        expect(voice.frequency).toBeGreaterThan(0);
        expect(voice.duration).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to the default bank for an unknown id", () => {
    expect(soundBank("nope").id).toBe("synth");
  });
});
