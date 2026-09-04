/**
 * The ear-training session: the current question, what was answered, and
 * the progress that decides the next one. Importing this file has no side
 * effect; the view calls `hydrateEar()`.
 */

import { reactive, shallowRef } from "vue";
import { storedJson } from "../../../lib/persist.js";
import { analysisSettings } from "../../../audio/analysis.js";
import {
  EXERCISE_KINDS,
  generateExercise,
  type Exercise,
  type ExerciseKind,
  type Level
} from "../domain/exercise.js";
import {
  emptyProgress,
  grade,
  isCorrect,
  levelFor,
  type Progress
} from "../domain/grade.js";
import { createEarPlayer, phraseSeconds } from "../engine/player.js";

export const session = reactive({
  kind: "interval" as ExerciseKind,
  level: 1 as Level,
  /** Null until the first question is asked. */
  answered: null as string | null,
  correct: false,
  playing: false,
  streak: 0
});

export const exercise = shallowRef<Exercise | null>(null);
export const progress = reactive<Progress>(emptyProgress());

const player = createEarPlayer();
let playingTimer = 0;

const stored = storedJson<Progress>("ear.progress", emptyProgress, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<Record<ExerciseKind, unknown>>;
  for (const kind of EXERCISE_KINDS) {
    const entry = value[kind] as Partial<Progress[ExerciseKind]> | undefined;
    if (!entry) continue;
    base[kind] = {
      attempts: Number.isFinite(entry.attempts) ? Number(entry.attempts) : 0,
      correct: Number.isFinite(entry.correct) ? Number(entry.correct) : 0,
      recent: Array.isArray(entry.recent) ? entry.recent.filter((x) => typeof x === "boolean") : []
    };
  }
  return base;
});

const storedKind = storedJson<ExerciseKind>(
  "ear.kind",
  () => "interval",
  (raw, base) => (EXERCISE_KINDS.includes(raw as ExerciseKind) ? (raw as ExerciseKind) : base)
);

export function hydrateEar(): void {
  Object.assign(progress, stored.read());
  session.kind = storedKind.read();
  session.level = levelFor(progress, session.kind, session.level);
  if (!exercise.value) nextQuestion();
}

/** Ask a new question at the level the recent results earned. */
export function nextQuestion(): void {
  session.level = levelFor(progress, session.kind, session.level);
  session.answered = null;
  session.correct = false;
  exercise.value = generateExercise(session.kind, session.level, Math.random);
  void replay();
}

export function setKind(kind: ExerciseKind): void {
  session.kind = kind;
  storedKind.write(kind);
  session.streak = 0;
  nextQuestion();
}

/** Play the question again; the answer is never revealed by replaying. */
export async function replay(): Promise<void> {
  const current = exercise.value;
  if (!current) return;
  await player.play(current.notes, analysisSettings.tuning);
  session.playing = true;
  window.clearTimeout(playingTimer);
  playingTimer = window.setTimeout(
    () => {
      session.playing = false;
    },
    (phraseSeconds(current.notes) + 0.2) * 1000
  );
}

export function answer(choice: string): void {
  const current = exercise.value;
  if (!current || session.answered !== null) return;
  const right = isCorrect(current.answer, choice);
  session.answered = choice;
  session.correct = right;
  session.streak = right ? session.streak + 1 : 0;
  Object.assign(progress, grade(progress, current.kind, right));
  stored.write({ ...progress });
}

/** Leaving the tool: stop holding the audio lease. */
export function releaseEar(): void {
  window.clearTimeout(playingTimer);
  session.playing = false;
  player.dispose();
}
