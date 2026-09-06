/**
 * Playing a question.
 *
 * A phrase is short and fully known in advance, so every note is placed on
 * the audio clock in one go — the look-ahead scheduler exists for streams
 * that never end, which this is not. The timbre is a few partials over a
 * soft attack: a bare sine is hard to hear an interval in.
 */

import { acquireAudio } from "../../../audio/context.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { createVoicePlayer, type VoicePlayer, type VoiceSpec } from "../../../audio/voice.js";
import { getTimbre, timbreSpec } from "../../../audio/timbre.js";
import type { ExerciseNote } from "../domain/exercise.js";

/** A singable tone rather than a test tone; the shape itself is data. */
export function noteSpec(midi: number, duration: number, tuning = 440): VoiceSpec {
  return timbreSpec(getTimbre("singable"), midi, duration, tuning);
}

export interface EarPlayer {
  play(notes: readonly ExerciseNote[], tuning: number): Promise<void>;
  /** Seconds the phrase will take. */
  dispose(): void;
}

export function createEarPlayer(): EarPlayer {
  let lease: AudioEngineHandle | null = null;
  let voices: VoicePlayer | null = null;

  return {
    async play(notes, tuning) {
      if (!lease) {
        lease = await acquireAudio();
        voices = createVoicePlayer(lease.context, lease.master, 0.9);
      }
      const start = lease.context.currentTime + 0.08;
      for (const note of notes) {
        voices?.play(noteSpec(note.midi, note.duration, tuning), start + note.at);
      }
    },
    dispose() {
      voices?.dispose();
      voices = null;
      lease?.release();
      lease = null;
    }
  };
}

/** How long a phrase lasts, for the "playing" indicator. */
export function phraseSeconds(notes: readonly ExerciseNote[]): number {
  return notes.reduce((longest, note) => Math.max(longest, note.at + note.duration), 0);
}
