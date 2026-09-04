import { describe, expect, it } from "vitest";
import { EXERCISE_KINDS, generateExercise } from "../src/features/ear/domain/exercise.js";
import { grade, isCorrect, levelFor, nextLevel } from "../src/features/ear/domain/grade.js";

/** Deterministic "random": walks a fixed list, so a test can name the question. */
function rngFrom(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("exercise generation", () => {
  it("offers the kinds the dictionary must cover", () => {
    expect(EXERCISE_KINDS).toEqual(["interval", "chord", "scale"]);
  });

  for (const kind of EXERCISE_KINDS) {
    it(`${kind}: is fully determined by the injected rng`, () => {
      const a = generateExercise(kind, 1, rngFrom([0.1, 0.4, 0.7, 0.2]));
      const b = generateExercise(kind, 1, rngFrom([0.1, 0.4, 0.7, 0.2]));
      expect(b).toEqual(a);
    });

    it(`${kind}: the answer is always among the choices`, () => {
      for (let seed = 0; seed < 20; seed += 1) {
        const exercise = generateExercise(kind, 2, rngFrom([seed / 20, 0.3, 0.9, 0.5]));
        expect(exercise.choices).toContain(exercise.answer);
        expect(new Set(exercise.choices).size).toBe(exercise.choices.length);
      }
    });

    it(`${kind}: every note is inside a range a small speaker can play`, () => {
      for (let seed = 0; seed < 20; seed += 1) {
        const exercise = generateExercise(kind, 3, rngFrom([seed / 20, 0.8, 0.1, 0.6]));
        for (const note of exercise.notes) {
          expect(note.midi).toBeGreaterThanOrEqual(48);
          expect(note.midi).toBeLessThanOrEqual(84);
        }
        expect(exercise.notes.length).toBeGreaterThan(1);
      }
    });
  }

  it("interval: easier levels ask only the easier intervals", () => {
    const easy = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      easy.add(generateExercise("interval", 1, rngFrom([seed / 40, 0.5, 0.5, 0.5])).answer);
    }
    expect(easy.has("m2")).toBe(false);
    expect([...easy].every((key) => ["P1", "m3", "M3", "P5", "P8"].includes(key))).toBe(true);
  });

  it("interval: the hardest level can ask anything", () => {
    const all = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      all.add(generateExercise("interval", 3, rngFrom([seed / 200, 0.5, 0.31, 0.7])).answer);
    }
    expect(all.size).toBeGreaterThan(8);
  });

  it("plays harmonically only when asked", () => {
    const melodic = generateExercise("interval", 1, rngFrom([0.1, 0.2, 0.1, 0.3]));
    expect(melodic.notes.every((note, index) => index === 0 || note.at > 0)).toBe(true);
  });
});

describe("grading", () => {
  it("is right only for the answer", () => {
    expect(isCorrect("P5", "P5")).toBe(true);
    expect(isCorrect("P5", "P4")).toBe(false);
  });

  it("keeps a rolling accuracy per kind", () => {
    let progress = grade(undefined, "interval", true);
    progress = grade(progress, "interval", true);
    progress = grade(progress, "interval", false);
    expect(progress.interval.attempts).toBe(3);
    expect(progress.interval.correct).toBe(2);
    expect(progress.interval.recent).toEqual([true, true, false]);
  });

  it("forgets old attempts, so today's accuracy is today's", () => {
    let progress = grade(undefined, "interval", false);
    for (let i = 0; i < 30; i += 1) progress = grade(progress, "interval", true);
    expect(progress.interval.recent.length).toBeLessThanOrEqual(20);
    expect(progress.interval.recent.every(Boolean)).toBe(true);
  });
});

describe("difficulty ladder", () => {
  const streak = (results: boolean[]) => ({ attempts: results.length, correct: results.filter(Boolean).length, recent: results });

  it("promotes on a strong run", () => {
    expect(nextLevel(1, streak(Array(10).fill(true)))).toBe(2);
  });

  it("demotes when accuracy collapses", () => {
    expect(nextLevel(3, streak(Array(10).fill(false)))).toBe(2);
  });

  it("holds in the middle, and inside the bounds", () => {
    const mixed = streak([true, false, true, false, true, true, false, true, false, true]);
    expect(nextLevel(2, mixed)).toBe(2);
    expect(nextLevel(3, streak(Array(10).fill(true)))).toBe(3);
    expect(nextLevel(1, streak(Array(10).fill(false)))).toBe(1);
  });

  it("waits for enough attempts before moving anyone", () => {
    expect(nextLevel(1, streak([true, true]))).toBe(1);
  });

  it("reads a level back from progress", () => {
    expect(levelFor({ interval: streak(Array(10).fill(true)) } as never, "interval")).toBe(2);
  });
});
