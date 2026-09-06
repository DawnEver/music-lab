/**
 * Keyboard state: where the keyboard sits, what it sounds like, and what
 * is currently down.
 *
 * Importing this file has no side effect; the view calls
 * `hydrateKeyboard()`. The audio lease is taken on the first note and not
 * before — opening the page should not start an AudioContext.
 */

import { reactive, shallowRef } from "vue";
import { acquireAudio } from "../../../audio/context.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { createVoicePlayer } from "../../../audio/voice.js";
import { DEFAULT_TIMBRE_ID, TIMBRES, type TimbreId } from "../../../audio/timbre.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { storedJson } from "../../../lib/persist.js";
import {
  DEFAULT_BASE_MIDI,
  MAX_BASE_MIDI,
  MIN_BASE_MIDI,
  shiftBase
} from "../domain/keymap.js";
import { createPerformer, type Performer } from "../engine/performer.js";

export interface KeyboardSettings {
  baseMidi: number;
  timbreId: TimbreId;
  volume: number;
}

function defaults(): KeyboardSettings {
  return { baseMidi: DEFAULT_BASE_MIDI, timbreId: DEFAULT_TIMBRE_ID, volume: 0.8 };
}

export const settings = reactive<KeyboardSettings>(defaults());

/** Notes currently sounding, so the view can light the keys up. */
export const sounding = reactive(new Set<number>());

const stored = storedJson<KeyboardSettings>("keyboard", defaults, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<KeyboardSettings>;
  const baseMidi = typeof value.baseMidi === "number" ? value.baseMidi : base.baseMidi;
  return {
    // A base note from an older layout may sit outside today's range.
    baseMidi: Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, Math.round(baseMidi / 12) * 12)),
    // A timbre that no longer exists must not survive as a dead chip.
    timbreId: TIMBRES.some((entry) => entry.id === value.timbreId)
      ? (value.timbreId as TimbreId)
      : base.timbreId,
    volume: typeof value.volume === "number" ? Math.min(1, Math.max(0, value.volume)) : base.volume
  };
});

const performer = shallowRef<Performer | null>(null);
let lease: AudioEngineHandle | null = null;

function persist(): void {
  stored.write({ ...settings });
}

export function hydrateKeyboard(): void {
  Object.assign(settings, stored.read());
}

/**
 * The primary action is never disabled: pressing a key acquires audio if
 * it has to. Everything after the first note is synchronous, so held
 * notes and the clock never drift apart.
 */
async function ensurePerformer(): Promise<Performer> {
  if (performer.value) return performer.value;
  lease = await acquireAudio();
  const player = createVoicePlayer(lease.context, lease.master, settings.volume);
  const unit = createPerformer({
    player,
    now: () => lease!.context.currentTime,
    timbreId: settings.timbreId,
    tuning: analysisSettings.tuning
  });
  performer.value = unit;
  return unit;
}

export async function noteOn(midi: number, velocity = 0.8): Promise<void> {
  sounding.add(midi);
  const unit = await ensurePerformer();
  // The key may already have come back up while audio was starting.
  if (!sounding.has(midi)) return;
  unit.setTuning(analysisSettings.tuning);
  unit.noteOn(midi, velocity);
}

export function noteOff(midi: number): void {
  sounding.delete(midi);
  performer.value?.noteOff(midi);
}

export function allNotesOff(): void {
  sounding.clear();
  performer.value?.allOff();
}

export function setBaseMidi(value: number): void {
  settings.baseMidi = Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, value));
  // The map moves out from under the fingers; anything down would hang.
  allNotesOff();
  persist();
}

export function shiftOctave(delta: number): void {
  setBaseMidi(shiftBase(settings.baseMidi, delta));
}

export function setTimbre(id: TimbreId): void {
  settings.timbreId = id;
  performer.value?.setTimbre(id);
  persist();
}

export function setVolume(value: number): void {
  settings.volume = Math.min(1, Math.max(0, value));
  performer.value?.setVolume(settings.volume);
  persist();
}

export function releaseKeyboard(): void {
  performer.value?.dispose();
  performer.value = null;
  sounding.clear();
  lease?.release();
  lease = null;
}
