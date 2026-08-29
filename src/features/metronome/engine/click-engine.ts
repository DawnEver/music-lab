/**
 * Turns a click voice into sound at an exact audio-clock time.
 *
 * Synth voices are an oscillator plus a short exponential envelope — no
 * assets, no decode, no latency. The noise voice (hi-hat) uses one small
 * pre-rendered buffer, which is what MDN recommends for short samples.
 */

import type { Accent } from "../domain/accent.js";
import { clickVoice, soundBank, type SoundBank } from "./sound-bank.js";
import type { Voice } from "../domain/rhythm.js";

export interface ClickEngine {
  setBank(id: string): void;
  setVolume(value: number): void;
  /** Fire a click at an absolute `AudioContext.currentTime`. */
  play(accent: Accent, time: number, voice?: Voice): void;
  dispose(): void;
}

function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createClickEngine(
  context: AudioContext,
  destination: AudioNode,
  bankId = "synth"
): ClickEngine {
  let bank: SoundBank = soundBank(bankId);
  let noise: AudioBuffer | null = null;

  const out = context.createGain();
  out.gain.value = 0.8;
  out.connect(destination);

  return {
    setBank(id: string) {
      bank = soundBank(id);
    },
    setVolume(value: number) {
      out.gain.setTargetAtTime(Math.min(1, Math.max(0, value)), context.currentTime, 0.01);
    },
    play(accent: Accent, time: number, voice: Voice = "main") {
      if (accent === "mute") return;

      const spec = clickVoice(bank, accent);
      // The second voice of a polyrhythm sits a fifth below so the two
      // layers stay separable by ear.
      const detune = voice === "poly" ? 0.66 : 1;
      const at = Math.max(time, context.currentTime);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(Math.max(spec.gain, 0.001), at + 0.001);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + spec.duration);
      envelope.connect(out);

      if (spec.wave === "noise") {
        if (!noise) noise = createNoiseBuffer(context);
        const source = context.createBufferSource();
        source.buffer = noise;
        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = spec.frequency * detune;
        source.connect(filter);
        filter.connect(envelope);
        source.start(at);
        source.stop(at + spec.duration + 0.02);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          envelope.disconnect();
        };
        return;
      }

      const oscillator = context.createOscillator();
      oscillator.type = spec.wave;
      oscillator.frequency.setValueAtTime(spec.frequency * detune, at);
      // A tiny downward glide is what makes a beep read as a "click".
      oscillator.frequency.exponentialRampToValueAtTime(
        spec.frequency * detune * 0.82,
        at + spec.duration
      );
      oscillator.connect(envelope);
      oscillator.start(at);
      oscillator.stop(at + spec.duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    },
    dispose() {
      try {
        out.disconnect();
      } catch (_) {
        // Already detached.
      }
    }
  };
}
