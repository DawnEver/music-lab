/**
 * A sight-singing take: give the key, count in, record, judge.
 *
 * The take rides the same clock as everything else, which is the whole
 * reason this is short: the melody's note times and the columns the
 * microphone produced are already on one timeline, so judging is a
 * comparison rather than an alignment.
 */

import { reactive, shallowRef } from "vue";
import { acquireAudio } from "../../../audio/context.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { createVoicePlayer, type VoicePlayer } from "../../../audio/voice.js";
import { historyBuffer, startHistory, stopHistory } from "../../../audio/history.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { sourceStore } from "../../../audio/source.js";
import { midiToFrequency } from "../../../lib/music-theory.js";
import { generateMelody, melodySeconds, type Melody } from "../domain/melody.js";
import { judgeSinging, type TakeVerdict } from "../domain/sing-judge.js";
import { noteSpec } from "../engine/player.js";

export type SingPhase = "idle" | "tonic" | "countIn" | "recording" | "judged";

export const sing = reactive({
  phase: "idle" as SingPhase,
  bpm: 72,
  bars: 2,
  tonicMidi: 60,
  /** Audio-clock time the melody starts at; 0 when not running. */
  startedAt: 0,
  /**
   * Keep going: tonic, count-in, sing, verdict, next line. A singer with
   * a phone on a music stand cannot press a button between every attempt.
   */
  loop: true,
  /** True while a loop is running, so the button reads "stop". */
  running: false
});

/** How long the verdict stays up before the next line. */
const REVIEW_MS = 2600;

export const melody = shallowRef<Melody | null>(null);
export const verdict = shallowRef<TakeVerdict | null>(null);

let lease: AudioEngineHandle | null = null;
let voices: VoicePlayer | null = null;
let timer = 0;
let loopTimer = 0;

async function ensureOutput(): Promise<AudioEngineHandle> {
  if (!lease) {
    lease = await acquireAudio();
    voices = createVoicePlayer(lease.context, lease.master, 0.9);
  }
  return lease;
}

export function newMelody(): void {
  melody.value = generateMelody(
    { bars: sing.bars, tonicMidi: sing.tonicMidi, bpm: sing.bpm },
    Math.random
  );
  verdict.value = null;
  sing.phase = "idle";
  sing.startedAt = 0;
}

/** Sound the tonic, so the singer has a pitch to start from. */
export async function playTonic(): Promise<void> {
  const handle = await ensureOutput();
  voices?.play(noteSpec(sing.tonicMidi, 1.1, analysisSettings.tuning), handle.context.currentTime + 0.05);
}

/** Play the written line, at tempo. */
export async function playMelody(): Promise<void> {
  const current = melody.value;
  if (!current) return;
  const handle = await ensureOutput();
  const start = handle.context.currentTime + 0.1;
  for (const note of current.notes) {
    voices?.play(
      noteSpec(note.midi, note.duration * 0.9, analysisSettings.tuning),
      start + note.start
    );
  }
}

/**
 * Sound the tonic, count in, then record. Recording is not a separate
 * capture: it is a window of the history the trace view already keeps, so
 * the take can be judged the instant it ends.
 */
export async function startTake(): Promise<void> {
  const current = melody.value;
  if (!current || sing.phase === "countIn" || sing.phase === "recording") return;
  if (sourceStore.mode === "idle") return;

  const handle = await ensureOutput();
  startHistory();
  verdict.value = null;
  sing.running = true;

  const beat = 60 / sing.bpm;
  const countIn = 4;
  // The tonic first, always: nobody can start a line without a pitch to
  // start from, and asking for it by hand every time is friction.
  const tonicSeconds = 1.1;
  voices?.play(
    noteSpec(sing.tonicMidi, tonicSeconds, analysisSettings.tuning),
    handle.context.currentTime + 0.05
  );
  sing.phase = "tonic";
  const begin = handle.context.currentTime + 0.15 + tonicSeconds;
  for (let index = 0; index < countIn; index += 1) {
    voices?.play(
      {
        waveform: "triangle",
        frequency: index === 0 ? 1320 : 880,
        gain: index === 0 ? 0.5 : 0.32,
        duration: 0.05,
        glide: 0.82
      },
      begin + index * beat
    );
  }

  sing.phase = "countIn";
  sing.startedAt = begin + countIn * beat;

  window.clearTimeout(timer);
  timer = window.setTimeout(
    () => {
      sing.phase = "recording";
      timer = window.setTimeout(finishTake, melodySeconds(current) * 1000 + 300);
    },
    (sing.startedAt - handle.context.currentTime) * 1000
  );
}

function finishTake(): void {
  const current = melody.value;
  if (!current) return;
  verdict.value = judgeSinging(current, historyBuffer.columns(), sing.startedAt);
  sing.phase = "judged";

  if (!sing.loop) {
    sing.running = false;
    return;
  }
  // Look at the result, then go again on a new line.
  loopTimer = window.setTimeout(() => {
    newMelody();
    void startTake();
  }, REVIEW_MS);
}

/** Stop the loop where it is; the verdict on screen stays. */
export function stopLoop(): void {
  window.clearTimeout(loopTimer);
  window.clearTimeout(timer);
  loopTimer = 0;
  timer = 0;
  sing.running = false;
  if (sing.phase !== "judged") sing.phase = "idle";
}

export function cancelTake(): void {
  window.clearTimeout(timer);
  window.clearTimeout(loopTimer);
  timer = 0;
  loopTimer = 0;
  sing.running = false;
  sing.phase = "idle";
  sing.startedAt = 0;
}

export function setLoop(value: boolean): void {
  sing.loop = value;
  if (!value) window.clearTimeout(loopTimer);
}

/** Leaving the tool: drop the lease and stop capturing. */
export function releaseSing(): void {
  cancelTake();
  stopHistory();
  voices?.dispose();
  voices = null;
  lease?.release();
  lease = null;
}

/** The written line as segments on the audio clock, for the plot. */
export function targetSegments() {
  const current = melody.value;
  if (!current) return [];
  const grades = verdict.value?.notes ?? [];
  return current.notes.map((note, index) => ({
    hz: midiToFrequency(note.midi, analysisSettings.tuning),
    start: sing.startedAt + note.start,
    end: sing.startedAt + note.start + note.duration,
    grade: grades[index]?.grade
  }));
}
