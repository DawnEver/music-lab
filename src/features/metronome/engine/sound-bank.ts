/**
 * Click voices. A bank is plain data — frequency, gain and envelope per
 * accent — so adding wood block / cowbell / hi-hat is a data change, not
 * an engine change.
 */

import type { Accent } from "../domain/accent.js";

export type ClickWave = "sine" | "triangle" | "square" | "noise";

export interface ClickVoice {
  frequency: number;
  gain: number;
  /** Envelope length in seconds. */
  duration: number;
  wave: ClickWave;
}

/** Closed set: the dictionary carries a `clickSound.<id>` for each. */
export type SoundBankId = "synth" | "digital" | "woodblock" | "clave" | "cowbell" | "hihat";

export interface SoundBank {
  id: SoundBankId;
  /** i18n key — `clickSound.<id>`. */
  voices: Record<Exclude<Accent, "mute">, ClickVoice>;
}

function bank(
  id: SoundBankId,
  wave: ClickWave,
  base: number,
  duration: number,
  spread = 1.5
): SoundBank {
  return {
    id,
    voices: {
      strong: { frequency: base * spread, gain: 1, duration, wave },
      medium: { frequency: base * 1.18, gain: 0.68, duration, wave },
      weak: { frequency: base, gain: 0.5, duration, wave },
      subdivision: { frequency: base * 0.72, gain: 0.26, duration: duration * 0.7, wave }
    }
  };
}

export const SOUND_BANKS: SoundBank[] = [
  bank("synth", "sine", 880, 0.045),
  bank("digital", "square", 1200, 0.03, 1.4),
  bank("woodblock", "triangle", 1050, 0.05, 1.6),
  bank("clave", "triangle", 2200, 0.035, 1.35),
  bank("cowbell", "square", 620, 0.07, 1.5),
  bank("hihat", "noise", 7200, 0.028, 1.25)
];

export const DEFAULT_BANK_ID: SoundBankId = "synth";

export function soundBank(id: string): SoundBank {
  return SOUND_BANKS.find((entry) => entry.id === id) ?? SOUND_BANKS[0];
}

export function clickVoice(bank: SoundBank, accent: Accent): ClickVoice {
  if (accent === "mute") return bank.voices.weak;
  return bank.voices[accent];
}
