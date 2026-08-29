import { describe, expect, it } from "vitest";
import {
  makeMeter,
  meterPulses,
  meterLabel,
  groupStarts,
  isCompound,
  parseGroups
} from "../src/features/metronome/domain/meter.js";
import {
  defaultAccents,
  nextAccent,
  resizeAccents
} from "../src/features/metronome/domain/accent.js";
import { pulseSeconds, barSeconds, clampBpm, tapTempo } from "../src/features/metronome/domain/tempo.js";
import { compileBar, swingOffset } from "../src/features/metronome/domain/rhythm.js";
import { METER_PRESETS } from "../src/features/metronome/domain/presets.js";
import { practiceForBar, defaultPractice } from "../src/features/metronome/domain/practice.js";

describe("meter", () => {
  it("derives the numerator from the additive groups", () => {
    expect(meterPulses(makeMeter(8, [2, 2, 3]))).toBe(7);
    expect(meterPulses(makeMeter(4, [1, 1, 1, 1]))).toBe(4);
    expect(meterPulses(makeMeter(8, [3, 3, 3, 2]))).toBe(11);
  });

  it("labels additive meters with their grouping", () => {
    expect(meterLabel(makeMeter(4, [1, 1, 1, 1]))).toBe("4/4");
    expect(meterLabel(makeMeter(8, [3, 3]))).toBe("6/8 (3+3)");
    expect(meterLabel(makeMeter(8, [2, 3]))).toBe("5/8 (2+3)");
  });

  it("marks the first pulse of every group", () => {
    expect(groupStarts(makeMeter(8, [2, 2, 3]))).toEqual([0, 2, 4]);
    expect(groupStarts(makeMeter(8, [3, 3]))).toEqual([0, 3]);
  });

  it("treats all-threes eighth meters as compound", () => {
    expect(isCompound(makeMeter(8, [3, 3]))).toBe(true);
    expect(isCompound(makeMeter(8, [2, 3]))).toBe(false);
    expect(isCompound(makeMeter(4, [1, 1, 1, 1]))).toBe(false);
  });

  it("parses a grouping string and rejects garbage", () => {
    expect(parseGroups("2+2+3")).toEqual([2, 2, 3]);
    expect(parseGroups("3 3 3")).toEqual([3, 3, 3]);
    expect(parseGroups("")).toBeNull();
    expect(parseGroups("2+x")).toBeNull();
    expect(parseGroups("0+2")).toBeNull();
  });

  it("normalizes an empty grouping to a single pulse", () => {
    expect(makeMeter(4, []).groups).toEqual([1]);
  });
});

describe("accent", () => {
  it("accents the first group strong and the other group starts medium", () => {
    expect(defaultAccents(makeMeter(8, [2, 2, 3]))).toEqual([
      "strong",
      "weak",
      "medium",
      "weak",
      "medium",
      "weak",
      "weak"
    ]);
  });

  it("cycles through the editable accent states", () => {
    expect(nextAccent("strong")).toBe("medium");
    expect(nextAccent("medium")).toBe("weak");
    expect(nextAccent("weak")).toBe("mute");
    expect(nextAccent("mute")).toBe("strong");
  });

  it("keeps user edits when the bar grows and truncates when it shrinks", () => {
    const meter = makeMeter(8, [2, 2, 3]);
    const edited = defaultAccents(meter);
    edited[1] = "medium";
    const grown = resizeAccents(edited, makeMeter(8, [2, 2, 3, 2]));
    expect(grown).toHaveLength(9);
    expect(grown[1]).toBe("medium");
    expect(resizeAccents(edited, makeMeter(4, [1, 1]))).toHaveLength(2);
  });
});

describe("tempo", () => {
  it("makes a quarter note exactly 0.5s at 120 BPM", () => {
    expect(pulseSeconds({ bpm: 120, beatUnit: 4 }, makeMeter(4, [1, 1, 1, 1]))).toBeCloseTo(0.5, 12);
  });

  it("scales the pulse when the meter denominator differs from the beat unit", () => {
    expect(pulseSeconds({ bpm: 120, beatUnit: 4 }, makeMeter(8, [3, 3]))).toBeCloseTo(0.25, 12);
    expect(pulseSeconds({ bpm: 60, beatUnit: 4 }, makeMeter(16, [4, 4]))).toBeCloseTo(0.25, 12);
  });

  it("gives a 4/4 bar four beats of length", () => {
    expect(barSeconds({ bpm: 120, beatUnit: 4 }, makeMeter(4, [1, 1, 1, 1]))).toBeCloseTo(2, 12);
  });

  it("clamps the BPM to a musical range", () => {
    expect(clampBpm(0)).toBe(20);
    expect(clampBpm(1000)).toBe(400);
    expect(clampBpm(120.6)).toBe(121);
  });

  it("averages tap intervals and drops stale taps", () => {
    expect(tapTempo([1000, 1500, 2000, 2500])).toBe(120);
    expect(tapTempo([1000])).toBeNull();
    // A gap longer than 3s starts a new measurement.
    expect(tapTempo([0, 9000, 9500, 10000])).toBe(120);
  });
});

describe("rhythm compiler", () => {
  const straight = { divisions: 1, swing: 0 };

  it("emits one event per pulse for 7/8 [2,2,3]", () => {
    const events = compileBar({
      meter: makeMeter(8, [2, 2, 3]),
      accents: defaultAccents(makeMeter(8, [2, 2, 3])),
      subdivision: straight
    }, 0.25);
    expect(events).toHaveLength(7);
    expect(events.map((e) => e.accent)).toEqual([
      "strong", "weak", "medium", "weak", "medium", "weak", "weak"
    ]);
    expect(events[2].time).toBeCloseTo(0.5, 12);
  });

  it("accents 6/8 on the 1st and 4th eighth", () => {
    const meter = makeMeter(8, [3, 3]);
    const events = compileBar({ meter, accents: defaultAccents(meter), subdivision: straight }, 0.25);
    expect(events.filter((e) => e.accent !== "weak").map((e) => e.pulse)).toEqual([0, 3]);
  });

  it("places triplet subdivisions evenly inside the beat", () => {
    const meter = makeMeter(4, [1, 1, 1, 1]);
    const events = compileBar(
      { meter, accents: defaultAccents(meter), subdivision: { divisions: 3, swing: 0 } },
      0.5
    );
    expect(events).toHaveLength(12);
    expect(events[1].time).toBeCloseTo(0.5 / 3, 12);
    expect(events[1].accent).toBe("subdivision");
    expect(events[3].accent).toBe("weak");
  });

  it("swing 0 is straight and swing 1 is a triplet feel", () => {
    expect(swingOffset(1, 2, 0)).toBeCloseTo(0.5, 12);
    expect(swingOffset(1, 2, 1)).toBeCloseTo(2 / 3, 12);
    expect(swingOffset(0, 2, 1)).toBeCloseTo(0, 12);
    // Odd division counts cannot swing in pairs.
    expect(swingOffset(1, 3, 1)).toBeCloseTo(1 / 3, 12);
  });

  it("drops muted pulses together with their subdivisions", () => {
    const meter = makeMeter(4, [1, 1]);
    const events = compileBar(
      { meter, accents: ["strong", "mute"], subdivision: { divisions: 2, swing: 0 } },
      0.5
    );
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.pulse === 0)).toBe(true);
  });

  it("lays a 3:2 polyrhythm evenly across the bar on its own voice", () => {
    const meter = makeMeter(4, [1, 1]);
    const events = compileBar(
      { meter, accents: defaultAccents(meter), subdivision: straight, polyrhythm: 3 },
      0.5
    );
    const poly = events.filter((e) => e.voice === "poly");
    expect(poly).toHaveLength(3);
    expect(poly.map((e) => e.time)).toEqual([0, 1 / 3, 2 / 3]);
    expect(events.filter((e) => e.voice === "main")).toHaveLength(2);
  });

  it("returns events sorted by time", () => {
    const meter = makeMeter(4, [1, 1, 1, 1]);
    const events = compileBar(
      { meter, accents: defaultAccents(meter), subdivision: { divisions: 2, swing: 0.5 }, polyrhythm: 3 },
      0.5
    );
    const times = events.map((e) => e.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("presets", () => {
  it("ships the usual simple, compound and additive meters", () => {
    const labels = METER_PRESETS.map((preset) => meterLabel(preset.meter));
    expect(labels).toContain("4/4");
    expect(labels).toContain("3/4");
    expect(labels).toContain("6/8 (3+3)");
    expect(labels).toContain("7/8 (2+2+3)");
    expect(labels).toContain("5/8 (2+3)");
    expect(labels).toContain("11/8 (3+3+3+2)");
  });

  it("every preset grouping matches its advertised numerator", () => {
    for (const preset of METER_PRESETS) {
      expect(meterPulses(preset.meter)).toBe(preset.numerator);
    }
  });
});

describe("practice mode", () => {
  it("is inert when disabled", () => {
    const plan = practiceForBar(defaultPractice(), 12, 100, () => 0);
    expect(plan).toEqual({ bpm: 100, silent: false });
  });

  it("ramps the tempo every N bars up to the ceiling", () => {
    const config = { ...defaultPractice(), rampEnabled: true, rampEveryBars: 2, rampBpm: 5, rampMaxBpm: 110 };
    expect(practiceForBar(config, 0, 100, () => 0).bpm).toBe(100);
    expect(practiceForBar(config, 1, 100, () => 0).bpm).toBe(100);
    expect(practiceForBar(config, 2, 100, () => 0).bpm).toBe(105);
    expect(practiceForBar(config, 4, 100, () => 0).bpm).toBe(110);
    expect(practiceForBar(config, 40, 100, () => 0).bpm).toBe(110);
  });

  it("mutes whole bars on the play/silent cycle", () => {
    const config = { ...defaultPractice(), silentEnabled: true, playBars: 2, silentBars: 2 };
    expect([0, 1, 2, 3, 4].map((bar) => practiceForBar(config, bar, 90, () => 0).silent)).toEqual([
      false, false, true, true, false
    ]);
  });

  it("mutes a bar at random with the configured probability", () => {
    const config = { ...defaultPractice(), randomMuteEnabled: true, randomMuteChance: 0.3 };
    expect(practiceForBar(config, 0, 90, () => 0.2).silent).toBe(true);
    expect(practiceForBar(config, 0, 90, () => 0.9).silent).toBe(false);
  });
});
