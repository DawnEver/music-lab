/**
 * The ear-training session: the current question, what was answered, and
 * the progress that decides the next one. Importing this file has no side
 * effect; the view calls `hydrateEar()`.
 */

import { reactive, shallowRef } from "vue";
import { storedJson } from "../../../lib/persist.js";
import { analysisSettings } from "../../../audio/analysis.js";
import {
  chooseExercise,
  EXERCISE_KINDS,
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
  streak: 0,
  /**
   * Answer, hear the verdict, get the next question — without a click in
   * between. Practice is a loop; making the learner press "next" a hundred
   * times is making them do the machine's job.
   */
  auto: true,
  /** Ticking down to the next question, in seconds; 0 when not waiting. */
  countdown: 0
});

/** How long the verdict stays up before the next question. */
const PAUSE_CORRECT_MS = 900;
/** Longer when wrong: there is something to look at. */
const PAUSE_WRONG_MS = 2400;

export const exercise = shallowRef<Exercise | null>(null);
export const progress = reactive<Progress>(emptyProgress());

const player = createEarPlayer();
let playingTimer = 0;
let advanceTimer = 0;
let countdownTimer = 0;

/** Recent misses per answer, so the generator can lean on them. */
const missed: Record<string, number> = {};

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

const storedAuto = storedJson<boolean>(
  "ear.auto",
  () => true,
  (raw, base) => (typeof raw === "boolean" ? raw : base)
);

export function hydrateEar(): void {
  Object.assign(progress, stored.read());
  session.kind = storedKind.read();
  session.auto = storedAuto.read();
  session.level = levelFor(progress, session.kind, session.level);
  // The question has to belong to the restored kind: a stale one from
  // another kind leaves the chips and the answer pad disagreeing.
  if (!exercise.value || exercise.value.kind !== session.kind) nextQuestion();
}

/** Ask a new question at the level the recent results earned. */
export function nextQuestion(): void {
  cancelAdvance();
  session.level = levelFor(progress, session.kind, session.level);
  const previous = exercise.value?.answer ?? null;
  session.answered = null;
  session.correct = false;
  exercise.value = chooseExercise(session.kind, session.level, Math.random, {
    lastAnswer: previous,
    missed
  });
  void replay();
}

function cancelAdvance(): void {
  window.clearTimeout(advanceTimer);
  window.clearInterval(countdownTimer);
  advanceTimer = 0;
  countdownTimer = 0;
  session.countdown = 0;
}

/** Run the loop on: show the verdict, then ask the next one. */
function scheduleAdvance(correct: boolean): void {
  const delay = correct ? PAUSE_CORRECT_MS : PAUSE_WRONG_MS;
  session.countdown = Math.round(delay / 100) / 10;
  countdownTimer = window.setInterval(() => {
    session.countdown = Math.max(0, Math.round((session.countdown - 0.1) * 10) / 10);
  }, 100);
  advanceTimer = window.setTimeout(nextQuestion, delay);
}

/** Turn the loop on or off; off leaves the learner in control. */
export function setAuto(value: boolean): void {
  session.auto = value;
  storedAuto.write(value);
  if (!value) cancelAdvance();
  else if (session.answered !== null) scheduleAdvance(session.correct);
}

export function setKind(kind: ExerciseKind): void {
  cancelAdvance();
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

  // A miss is remembered so the same interval comes back sooner; getting
  // it right pays the debt down rather than clearing it outright.
  if (right) missed[current.answer] = Math.max(0, (missed[current.answer] ?? 0) - 1);
  else missed[current.answer] = Math.min(5, (missed[current.answer] ?? 0) + 2);

  Object.assign(progress, grade(progress, current.kind, right));
  stored.write({ ...progress });
  if (session.auto) scheduleAdvance(right);
}

/**
 * Start over. Progress that cannot be cleared is progress you stop
 * trusting — a level earned on a bad microphone follows you forever.
 */
export function resetProgress(): void {
  Object.assign(progress, emptyProgress());
  for (const key of Object.keys(missed)) delete missed[key];
  session.level = 1;
  session.streak = 0;
  stored.write({ ...progress });
  nextQuestion();
}

/** Leaving the tool: stop holding the audio lease. */
export function releaseEar(): void {
  cancelAdvance();
  window.clearTimeout(playingTimer);
  session.playing = false;
  player.dispose();
}
