import { describe, expect, it } from "vitest";
import { generateMelody, melodySeconds } from "../src/features/ear/domain/melody.js";
import { judgeSinging, judgeNote } from "../src/features/ear/domain/sing-judge.js";
import { midiToFrequency } from "../src/lib/music-theory.js";
import type { SpectrogramColumn } from "../src/lib/spectrogram.js";

function rngFrom(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

/** A steady sung tone over a window, optionally detuned in cents. */
function sung(
  midi: number,
  from: number,
  to: number,
  cents = 0,
  step = 0.03
): SpectrogramColumn[] {
  const columns: SpectrogramColumn[] = [];
  for (let time = from; time <= to; time += step) {
    columns.push({
      time,
      db: new Float32Array(0),
      pitchHz: midiToFrequency(midi, 440) * Math.pow(2, cents / 1200)
    });
  }
  return columns;
}

describe("melody generation", () => {
  it("is determined by the injected rng", () => {
    const a = generateMelody({ bars: 2, tonicMidi: 60, bpm: 80 }, rngFrom([0.2, 0.6, 0.1, 0.9]));
    const b = generateMelody({ bars: 2, tonicMidi: 60, bpm: 80 }, rngFrom([0.2, 0.6, 0.1, 0.9]));
    expect(b).toEqual(a);
  });

  it("starts on the tonic, so the singer has somewhere to stand", () => {
    const melody = generateMelody({ bars: 2, tonicMidi: 62, bpm: 90 }, rngFrom([0.7, 0.3, 0.5]));
    expect(melody.notes[0].midi).toBe(62);
  });

  it("stays in the key and inside a singable octave", () => {
    const scale = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (let seed = 0; seed < 20; seed += 1) {
      const melody = generateMelody(
        { bars: 2, tonicMidi: 60, bpm: 90 },
        rngFrom([seed / 20, 0.4, 0.8, 0.1])
      );
      for (const note of melody.notes) {
        expect(scale.has(((note.midi - 60) % 12 + 12) % 12)).toBe(true);
        expect(note.midi).toBeGreaterThanOrEqual(60 - 5);
        expect(note.midi).toBeLessThanOrEqual(60 + 12);
      }
    }
  });

  it("lays notes end to end on the beat grid", () => {
    const melody = generateMelody({ bars: 2, tonicMidi: 60, bpm: 60 }, rngFrom([0.5, 0.5, 0.5]));
    let cursor = 0;
    for (const note of melody.notes) {
      expect(note.start).toBeCloseTo(cursor, 6);
      cursor += note.duration;
    }
    // 2 bars of 4/4 at 60bpm is 8 seconds.
    expect(melodySeconds(melody)).toBeCloseTo(8, 6);
  });
});

describe("judging one note", () => {
  const target = { midi: 69, start: 1, duration: 1 };

  it("is in tune when the sung pitch sits on the note", () => {
    const verdict = judgeNote(target, sung(69, 1, 2));
    expect(verdict.sung).toBe(true);
    expect(Math.abs(verdict.centsOff!)).toBeLessThan(2);
    expect(verdict.grade).toBe("good");
  });

  it("measures how far off, with sign", () => {
    expect(judgeNote(target, sung(69, 1, 2, 40)).centsOff).toBeCloseTo(40, 0);
    expect(judgeNote(target, sung(69, 1, 2, -40)).centsOff).toBeCloseTo(-40, 0);
  });

  it("grades close, then out", () => {
    expect(judgeNote(target, sung(69, 1, 2, 35)).grade).toBe("close");
    expect(judgeNote(target, sung(69, 1, 2, 120)).grade).toBe("out");
  });

  it("ignores the onset, where every singer scoops", () => {
    // A scoop up to the note must not be averaged into the verdict.
    const scoop = sung(66, 1, 1.12).concat(sung(69, 1.15, 2));
    expect(Math.abs(judgeNote(target, scoop).centsOff!)).toBeLessThan(10);
  });

  it("reports silence rather than pretending to grade it", () => {
    const verdict = judgeNote(target, []);
    expect(verdict.sung).toBe(false);
    expect(verdict.centsOff).toBeNull();
    expect(verdict.grade).toBe("missed");
  });

  it("does not read the neighbouring notes", () => {
    const before = sung(60, 0, 0.99);
    const during = sung(69, 1, 2);
    const after = sung(76, 2.01, 3);
    expect(Math.abs(judgeNote(target, [...before, ...during, ...after]).centsOff!)).toBeLessThan(2);
  });

  it("accepts an octave transposition, which is a range problem, not a pitch error", () => {
    const verdict = judgeNote(target, sung(57, 1, 2));
    expect(verdict.grade).toBe("good");
    expect(verdict.octaveOff).toBe(-1);
  });
});

describe("judging a take", () => {
  const melody = {
    tonicMidi: 60,
    bpm: 60,
    notes: [
      { midi: 60, start: 0, duration: 1 },
      { midi: 62, start: 1, duration: 1 },
      { midi: 64, start: 2, duration: 1 }
    ]
  };

  it("scores every note and summarises the take", () => {
    const columns = [...sung(60, 0, 1), ...sung(62, 1, 2, 30), ...sung(64, 2, 3, 200)];
    const result = judgeSinging(melody, columns, 0);
    expect(result.notes.map((note) => note.grade)).toEqual(["good", "close", "out"]);
    expect(result.score).toBeCloseTo((1 + 0.6 + 0) / 3, 6);
  });

  it("offsets the take, so a count-in does not shift every note", () => {
    const columns = [...sung(60, 10, 11), ...sung(62, 11, 12), ...sung(64, 12, 13)];
    const result = judgeSinging(melody, columns, 10);
    expect(result.notes.every((note) => note.grade === "good")).toBe(true);
    expect(result.score).toBe(1);
  });

  it("counts a silent take as missed rather than perfect", () => {
    const result = judgeSinging(melody, [], 0);
    expect(result.notes.every((note) => note.grade === "missed")).toBe(true);
    expect(result.score).toBe(0);
  });
});

describe("register", () => {
  const melody = {
    tonicMidi: 60,
    bpm: 60,
    notes: [
      { midi: 60, start: 0, duration: 1 },
      { midi: 64, start: 1, duration: 1 }
    ]
  };

  it("an octave down is right, not an octave wrong", () => {
    // A tenor handed a soprano's line sings it an octave below. Judged
    // against the written pitches that reads as an octave error; judged
    // against the register he was asked to sing in, it is simply correct.
    const sungLow = [...sung(48, 0, 1), ...sung(52, 1, 2)];
    const asWritten = judgeSinging(melody, sungLow, 0);
    expect(asWritten.notes.every((note) => note.octaveOff === -1)).toBe(true);

    const transposed = {
      ...melody,
      tonicMidi: 48,
      notes: melody.notes.map((note) => ({ ...note, midi: note.midi - 12 }))
    };
    const inRegister = judgeSinging(transposed, sungLow, 0);
    expect(inRegister.notes.every((note) => note.octaveOff === 0)).toBe(true);
    expect(inRegister.score).toBe(1);
  });
});
