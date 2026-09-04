/**
 * Clicks: the metronome's mapping from an accent to a voice.
 *
 * Synthesis lives in `audio/voice.ts`; a bank is data. All this file does
 * is choose the spec — including the fifth-below detune that keeps the two
 * layers of a polyrhythm separable by ear.
 */

import { createVoicePlayer, type VoicePlayer, type VoiceSpec } from "../../../audio/voice.js";
import type { Accent } from "../domain/accent.js";
import type { Voice } from "../domain/rhythm.js";
import { clickVoice, soundBank, type SoundBank } from "./sound-bank.js";

export interface ClickEngine {
  setBank(id: string): void;
  setVolume(value: number): void;
  /** Fire a click at an absolute `AudioContext.currentTime`. */
  play(accent: Accent, time: number, voice?: Voice): void;
  dispose(): void;
}

/** A click is a short note with a slight downward glide. */
export function clickSpec(bank: SoundBank, accent: Accent, voice: Voice = "main"): VoiceSpec | null {
  if (accent === "mute") return null;
  const spec = clickVoice(bank, accent);
  const detune = voice === "poly" ? 0.66 : 1;
  return {
    waveform: spec.wave,
    frequency: spec.frequency * detune,
    gain: spec.gain,
    duration: spec.duration,
    glide: spec.wave === "noise" ? 1 : 0.82
  };
}

export function createClickEngine(
  context: AudioContext,
  destination: AudioNode,
  bankId = "synth"
): ClickEngine {
  let bank: SoundBank = soundBank(bankId);
  const player: VoicePlayer = createVoicePlayer(context, destination);

  return {
    setBank(id: string) {
      bank = soundBank(id);
    },
    setVolume(value: number) {
      player.setVolume(value);
    },
    play(accent: Accent, time: number, voice: Voice = "main") {
      const spec = clickSpec(bank, accent, voice);
      if (spec) player.play(spec, time);
    },
    dispose() {
      player.dispose();
    }
  };
}
