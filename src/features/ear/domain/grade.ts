/**
 * Grading and the difficulty ladder.
 *
 * Accuracy is measured over a rolling window rather than for all time: a
 * learner who was 40% last week and 90% today should be asked today's
 * questions. The same window decides promotion, so the ladder cannot be
 * dragged down by history.
 */

import { EXERCISE_KINDS, type ExerciseKind, type Level } from "./exercise.js";

/** How many recent attempts count towards accuracy and promotion. */
export const WINDOW = 20;
const MIN_ATTEMPTS = 6;
const PROMOTE_ABOVE = 0.85;
const DEMOTE_BELOW = 0.6;

export interface KindProgress {
  attempts: number;
  correct: number;
  /** Most recent results, oldest first, capped at WINDOW. */
  recent: boolean[];
}

export type Progress = Record<ExerciseKind, KindProgress>;

export function emptyProgress(): Progress {
  const empty = {} as Progress;
  for (const kind of EXERCISE_KINDS) empty[kind] = { attempts: 0, correct: 0, recent: [] };
  return empty;
}

export function isCorrect(answer: string, choice: string): boolean {
  return answer === choice;
}

export function accuracy(progress: KindProgress): number {
  if (!progress.recent.length) return 0;
  return progress.recent.filter(Boolean).length / progress.recent.length;
}

/** Record one attempt, returning a new progress record. */
export function grade(
  progress: Progress | undefined,
  kind: ExerciseKind,
  correct: boolean
): Progress {
  const base = progress ?? emptyProgress();
  const previous = base[kind] ?? { attempts: 0, correct: 0, recent: [] };
  const recent = [...previous.recent, correct].slice(-WINDOW);
  return {
    ...base,
    [kind]: {
      attempts: previous.attempts + 1,
      correct: previous.correct + (correct ? 1 : 0),
      recent
    }
  };
}

/** Where the ladder should sit after this run of attempts. */
export function nextLevel(current: Level, progress: KindProgress): Level {
  if (progress.recent.length < MIN_ATTEMPTS) return current;
  const rate = accuracy(progress);
  if (rate > PROMOTE_ABOVE) return Math.min(3, current + 1) as Level;
  if (rate < DEMOTE_BELOW) return Math.max(1, current - 1) as Level;
  return current;
}

export { type Progress as EarProgress };

/** The level a kind should be asked at now. */
export function levelFor(progress: Progress, kind: ExerciseKind, current: Level = 1): Level {
  return nextLevel(current, progress[kind] ?? { attempts: 0, correct: 0, recent: [] });
}
