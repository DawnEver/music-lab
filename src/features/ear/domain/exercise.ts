/**
 * Ear-training questions.
 *
 * A question type is a generator plus a set of choices — pure data in,
 * pure data out — so adding "seventh chords" or "modes" is a new entry in
 * a table, not a new code path through the player, the grader or the UI.
 *
 * Randomness is injected. That is what makes a question reproducible in a
 * test, and it also buys a shareable seed for a daily set.
 */

import { CHORD_TYPES } from "../../../lib/music-theory.js";
import { INTERVALS, type IntervalKey } from "../../../lib/interval.js";

/** Closed set: the dictionary carries an `ear.kind.<kind>` for each. */
export const EXERCISE_KINDS = ["interval", "chord", "scale"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

/** 1 easiest, 3 hardest. */
export type Level = 1 | 2 | 3;

export interface ExerciseNote {
  midi: number;
  /** Seconds from the start of the question. */
  at: number;
  /** Seconds to hold. */
  duration: number;
}

export interface Exercise {
  kind: ExerciseKind;
  level: Level;
  notes: ExerciseNote[];
  /** Choice ids; the UI translates them. */
  choices: string[];
  answer: string;
  /** The note the question is built on, for a "play the root" hint. */
  rootMidi: number;
}

/** Comfortable on a phone speaker and inside most singers' hearing. */
const LOW_MIDI = 48;
const HIGH_MIDI = 84;
const NOTE_SECONDS = 0.62;

type Rng = () => number;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** Distinct choices with the answer always among them, order deterministic. */
function choicesAround(all: string[], answer: string, count: number, rng: Rng): string[] {
  const pool = all.filter((entry) => entry !== answer);
  const chosen = [answer];
  while (chosen.length < Math.min(count, all.length) && pool.length) {
    const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    chosen.push(pool.splice(index, 1)[0]);
  }
  // Sorting by the canonical order keeps the keypad stable between
  // questions: a moving target is a memory test, not an ear test.
  return all.filter((entry) => chosen.includes(entry));
}

const SCALES: Array<{ key: string; steps: number[] }> = [
  { key: "major", steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  { key: "minor", steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  { key: "dorian", steps: [0, 2, 3, 5, 7, 9, 10, 12] },
  { key: "mixolydian", steps: [0, 2, 4, 5, 7, 9, 10, 12] },
  { key: "pentatonic", steps: [0, 2, 4, 7, 9, 12] },
  { key: "harmonicMinor", steps: [0, 2, 3, 5, 7, 8, 11, 12] }
];

function levelSlice<T extends { difficulty?: number }>(items: T[], level: Level): T[] {
  const allowed = items.filter((item) => (item.difficulty ?? 1) <= level);
  return allowed.length ? allowed : items;
}

function rootFor(level: Level, span: number, rng: Rng): number {
  const highest = HIGH_MIDI - span;
  const lowest = LOW_MIDI;
  // Level 1 stays around middle C; higher levels roam, so the answer can
  // never be recognised by register alone.
  const from = level === 1 ? 57 : lowest;
  const to = level === 1 ? Math.min(69, highest) : highest;
  return Math.round(from + rng() * Math.max(0, to - from));
}

function intervalExercise(level: Level, rng: Rng): Exercise {
  const allowed = levelSlice(INTERVALS, level);
  const interval = pick(allowed, rng);
  const root = rootFor(level, interval.semitones, rng);
  const notes: ExerciseNote[] = [
    { midi: root, at: 0, duration: NOTE_SECONDS },
    { midi: root + interval.semitones, at: NOTE_SECONDS, duration: NOTE_SECONDS }
  ];
  const all = allowed.map((entry) => entry.key as string);
  return {
    kind: "interval",
    level,
    notes,
    choices: choicesAround(all, interval.key, level === 1 ? 4 : all.length, rng),
    answer: interval.key,
    rootMidi: root
  };
}

const CHORD_LEVELS: Record<Level, string[]> = {
  1: ["major", "minor"],
  2: ["major", "minor", "dim", "aug"],
  3: ["major", "minor", "dim", "aug", "sus4", "dom7", "maj7", "m7"]
};

function chordExercise(level: Level, rng: Rng): Exercise {
  const keys = CHORD_LEVELS[level];
  const key = pick(keys, rng);
  const type = CHORD_TYPES.find((entry) => entry.key === key) ?? CHORD_TYPES[0];
  const span = Math.max(...type.intervals);
  const root = rootFor(level, span, rng);
  // Rolled slightly: a block chord hides its third on a small speaker.
  const notes = type.intervals.map((interval, index) => ({
    midi: root + interval,
    at: index * 0.08,
    duration: 1.2
  }));
  return {
    kind: "chord",
    level,
    notes,
    choices: choicesAround(keys, key, keys.length, rng),
    answer: key,
    rootMidi: root
  };
}

function scaleExercise(level: Level, rng: Rng): Exercise {
  const pool = level === 1 ? SCALES.slice(0, 2) : level === 2 ? SCALES.slice(0, 4) : SCALES;
  const scale = pick(pool, rng);
  const root = rootFor(level, 12, rng);
  const notes = scale.steps.map((step, index) => ({
    midi: root + step,
    at: index * 0.32,
    duration: 0.34
  }));
  return {
    kind: "scale",
    level,
    notes,
    choices: choicesAround(pool.map((entry) => entry.key), scale.key, pool.length, rng),
    answer: scale.key,
    rootMidi: root
  };
}

export function generateExercise(kind: ExerciseKind, level: Level, rng: Rng): Exercise {
  if (kind === "chord") return chordExercise(level, rng);
  if (kind === "scale") return scaleExercise(level, rng);
  return intervalExercise(level, rng);
}

/** The level a kind should be asked at, from its recent results. */
export { type IntervalKey };
