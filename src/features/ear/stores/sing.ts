/**
 * A sight-singing session.
 *
 * One loop, one button. A rep is: hear where "do" is, count in, sing,
 * see how it went — then the next line, automatically. Everything else is
 * a setting, not a step, so nothing in the loop needs a click.
 *
 * The take rides the same clock as everything else, which is why judging
 * is a comparison rather than an alignment.
 */

import { reactive, shallowRef } from "vue";
import { acquireAudio } from "../../../audio/context.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { createVoicePlayer, type VoicePlayer } from "../../../audio/voice.js";
import {
  historyBuffer,
  holdHistory,
  releaseHistoryHold,
  startHistory,
  stopHistory
} from "../../../audio/history.js";
import { analysisSettings, setDetectorRange } from "../../../audio/analysis.js";
import { sourceStore } from "../../../audio/source.js";
import { startMicrophone } from "../../../audio/session.js";
import { midiToFrequency } from "../../../lib/music-theory.js";
import { storedJson } from "../../../lib/persist.js";
import { generateMelody, melodySeconds, type Melody } from "../domain/melody.js";
import { judgeSinging, type TakeVerdict } from "../domain/sing-judge.js";
import { noteSpec } from "../engine/player.js";

/** What the loop is doing right now. */
export type SingPhase = "idle" | "tonic" | "countIn" | "recording" | "judged";

/** A voice can go lower and higher than any one instrument. */
const VOICE_RANGE = { minHz: 60, maxHz: 1400 };
export const COUNT_IN_BEATS = 4;
/** How long the tonic sounds before the count-in. */
const TONIC_SECONDS = 1.2;
/** How long the verdict stays up before the next line. */
const REVIEW_SECONDS = 2.6;

/** Registers the same written line can be sung in. */
export type Register = "written" | "octaveDown";

export const sing = reactive({
  phase: "idle" as SingPhase,
  bpm: 72,
  bars: 2,
  tonicMidi: 60,
  /**
   * Where the line is actually sung.
   *
   * A tenor handed a line written for a soprano sings it an octave down
   * and is not wrong — so the register is a setting, and everything that
   * sounds, draws or grades follows it. The written line does not move:
   * that is the point of a register.
   */
  register: "written" as Register,
  /** Audio-clock time the melody starts at; 0 when not running. */
  startedAt: 0,
  /** True from pressing start until pressing stop, across many reps. */
  running: false,
  /** Count-in beats left to play, for the display. */
  countIn: 0,
  /** Reps completed this session. */
  reps: 0
});

export const melody = shallowRef<Melody | null>(null);
export const verdict = shallowRef<TakeVerdict | null>(null);

let lease: AudioEngineHandle | null = null;
let voices: VoicePlayer | null = null;
const timers = new Set<number>();

function later(callback: () => void, seconds: number): void {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, Math.max(0, seconds * 1000));
  timers.add(id);
}

function clearTimers(): void {
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
}

async function ensureOutput(): Promise<AudioEngineHandle> {
  if (!lease) {
    lease = await acquireAudio();
    voices = createVoicePlayer(lease.context, lease.master, 0.9);
  }
  return lease;
}

export function beatSeconds(): number {
  return 60 / sing.bpm;
}

/** Semitones between what is written and what is sung. */
export function registerShift(): number {
  return sing.register === "octaveDown" ? -12 : 0;
}

/** The line as it will be sung: the written notes, moved to the register. */
function soundingMelody(): Melody | null {
  const current = melody.value;
  if (!current) return null;
  const shift = registerShift();
  if (!shift) return current;
  return {
    ...current,
    tonicMidi: current.tonicMidi + shift,
    notes: current.notes.map((note) => ({ ...note, midi: note.midi + shift }))
  };
}

export function setRegister(value: Register): void {
  sing.register = value;
  storedRegister.write(value);
}

const storedRegister = storedJson<Register>(
  "ear.register",
  () => "written",
  (raw, base) => (raw === "octaveDown" || raw === "written" ? raw : base)
);

/** Read the stored register; the view calls this once. */
export function hydrateSing(): void {
  sing.register = storedRegister.read();
}

export function newMelody(): void {
  melody.value = generateMelody(
    { bars: sing.bars, tonicMidi: sing.tonicMidi, bpm: sing.bpm },
    Math.random
  );
  verdict.value = null;
  sing.startedAt = 0;
}

/** Play the written line, at tempo — a preview, never part of a rep. */
export async function previewMelody(): Promise<void> {
  const current = melody.value;
  if (!current || sing.running) return;
  const sounding = soundingMelody();
  if (!sounding) return;
  const handle = await ensureOutput();
  const start = handle.context.currentTime + 0.1;
  // The preview comes out of the speakers; do not record it back in.
  holdHistory(TONIC_SECONDS + 0.4 + melodySeconds(sounding) + 0.3);
  voices?.play(noteSpec(sounding.tonicMidi, TONIC_SECONDS, analysisSettings.tuning), start);
  for (const note of sounding.notes) {
    voices?.play(
      noteSpec(note.midi, note.duration * 0.9, analysisSettings.tuning),
      start + TONIC_SECONDS + 0.2 + note.start
    );
  }
}

/**
 * Start practising. This is the only thing a singer has to press: it
 * acquires the microphone if it is not already listening, then runs reps
 * until stopped.
 */
export async function start(): Promise<void> {
  if (sing.running) return;
  sing.running = true;
  sing.reps = 0;
  // A primary action that is disabled until you find some other control is
  // not a primary action. If nothing is listening, start listening.
  if (sourceStore.mode === "idle") await startMicrophone();
  if (sourceStore.mode === "idle") {
    sing.running = false;
    return;
  }
  // A voice is not an instrument: whatever band the tuner last asked for
  // would silently swallow half the line.
  setDetectorRange(VOICE_RANGE);
  startHistory();
  await runRep();
}

/** Stop where we are; whatever is on screen stays on screen. */
export function stop(): void {
  clearTimers();
  releaseHistoryHold();
  sing.running = false;
  sing.countIn = 0;
  if (sing.phase !== "judged") sing.phase = "idle";
}

async function runRep(): Promise<void> {
  const current = melody.value;
  if (!current || !sing.running) return;

  const handle = await ensureOutput();
  verdict.value = null;
  const beat = beatSeconds();
  const now = handle.context.currentTime;
  const tonicAt = now + 0.15;

  // Tonic, so there is somewhere to start from.
  voices?.play(
    noteSpec(sing.tonicMidi + registerShift(), TONIC_SECONDS, analysisSettings.tuning),
    tonicAt
  );
  sing.phase = "tonic";

  const countInAt = tonicAt + TONIC_SECONDS + 0.25;
  for (let index = 0; index < COUNT_IN_BEATS; index += 1) {
    voices?.play(
      {
        waveform: "triangle",
        frequency: index === 0 ? 1320 : 880,
        gain: index === 0 ? 0.5 : 0.3,
        duration: 0.05,
        glide: 0.82
      },
      countInAt + index * beat
    );
  }

  sing.startedAt = countInAt + COUNT_IN_BEATS * beat;
  // The tonic and the count-in are the app's own sound: hold capture until
  // the singer's turn starts, so the take contains only the take.
  holdHistory(sing.startedAt - handle.context.currentTime);
  later(() => {
    sing.phase = "countIn";
    sing.countIn = COUNT_IN_BEATS;
    for (let index = 1; index < COUNT_IN_BEATS; index += 1) {
      later(() => {
        sing.countIn = COUNT_IN_BEATS - index;
      }, index * beat);
    }
  }, countInAt - now);

  later(() => {
    sing.phase = "recording";
    sing.countIn = 0;
  }, sing.startedAt - now);

  later(() => finishRep(), sing.startedAt - now + melodySeconds(current) + 0.35);
}

function finishRep(): void {
  const current = soundingMelody();
  if (!current) return;
  verdict.value = judgeSinging(current, historyBuffer.columns(), sing.startedAt);
  sing.phase = "judged";
  sing.reps += 1;
  if (!sing.running) return;
  later(() => {
    newMelody();
    void runRep();
  }, REVIEW_SECONDS);
}

/** Leaving the tool. */
export function releaseSing(): void {
  stop();
  stopHistory();
  setDetectorRange(null);
  sing.phase = "idle";
  sing.startedAt = 0;
  voices?.dispose();
  voices = null;
  lease?.release();
  lease = null;
}

export function setTonic(midi: number): void {
  sing.tonicMidi = midi;
  if (!sing.running) newMelody();
}

export function setTempo(bpm: number): void {
  sing.bpm = bpm;
  if (!sing.running) newMelody();
}

export function setBars(bars: number): void {
  sing.bars = bars;
  if (!sing.running) newMelody();
}

/**
 * The written line as segments on the audio clock.
 *
 * Before a rep starts there is no clock position for it, but the whole
 * point of sight-singing is seeing the line first — so an anchor can be
 * supplied to lay it out in whatever window is on screen.
 */
export function targetSegments(anchor = sing.startedAt) {
  const current = soundingMelody();
  if (!current) return [];
  const grades = verdict.value?.notes ?? [];
  return current.notes.map((note, index) => ({
    hz: midiToFrequency(note.midi, analysisSettings.tuning),
    start: anchor + note.start,
    end: anchor + note.start + note.duration,
    grade: sing.startedAt ? grades[index]?.grade : undefined
  }));
}

/** Window the plot should show: the rep, with a moment of lead-in. */
export function takeWindow(nowSeconds: number): { start: number; end: number } {
  const length = melody.value ? melodySeconds(melody.value) : 8;
  if (sing.startedAt) return { start: sing.startedAt - 1, end: sing.startedAt + length + 0.5 };
  // Idle: a window long enough to hold the line, ending now.
  return { start: nowSeconds - length - 1, end: nowSeconds + 0.5 };
}

/** Where to draw the line while nothing is running. */
export function previewAnchor(nowSeconds: number): number {
  return takeWindow(nowSeconds).start + 0.8;
}
