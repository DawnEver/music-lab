/**
 * The play tool's state: which instrument, how it is set up, and what is
 * currently sounding.
 *
 * The instrument decides everything about how it is played — its surface
 * decides what is drawn, its timbre decides what is heard. So there is no
 * separate "voice" setting to contradict the instrument name, and the
 * picker is not a control labelled with its own current state.
 *
 * Importing this file has no side effect; the view calls `hydratePlay()`.
 * The audio lease is taken on the first note and not before.
 */

import { computed, reactive, shallowRef } from "vue";
import { acquireAudio } from "../../../audio/context.js";
import type { AudioEngineHandle } from "../../../audio/types.js";
import { createVoicePlayer } from "../../../audio/voice.js";
import { getTimbre, timbreSpecAt } from "../../../audio/timbre.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { storedJson } from "../../../lib/persist.js";
import {
  getPlayableInstrument,
  getPreset,
  isTuned,
  playableInstruments
} from "../../../instruments/index.js";
import {
  DEFAULT_BASE_MIDI,
  MAX_BASE_MIDI,
  MIN_BASE_MIDI,
  shiftBase
} from "../domain/keymap.js";
import { createPerformer, type Performer } from "../engine/performer.js";

export const DEFAULT_INSTRUMENT = "piano";

export interface PlaySettings {
  instrumentId: string;
  /** Where the computer keyboard sits, for keyed instruments. */
  baseMidi: number;
  /** Chosen tuning per fretted instrument; the tuner's choice is its own. */
  presets: Record<string, string>;
  volume: number;
}

function defaults(): PlaySettings {
  return {
    instrumentId: DEFAULT_INSTRUMENT,
    baseMidi: DEFAULT_BASE_MIDI,
    presets: {},
    volume: 0.8
  };
}

export const settings = reactive<PlaySettings>(defaults());

/** Notes currently sounding, so the view can light up what is held. */
export const sounding = reactive(new Set<number>());
/** Pads hit in the last instant — a strike has no release to wait for. */
export const struck = reactive(new Set<string>());

const stored = storedJson<PlaySettings>("play", defaults, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<PlaySettings>;
  const baseMidi = typeof value.baseMidi === "number" ? value.baseMidi : base.baseMidi;
  return {
    // An instrument that no longer exists must not survive as a dead pick.
    instrumentId: getPlayableInstrument(String(value.instrumentId)) ? value.instrumentId! : base.instrumentId,
    baseMidi: Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, Math.round(baseMidi / 12) * 12)),
    presets: value.presets && typeof value.presets === "object" ? { ...value.presets } : base.presets,
    volume: typeof value.volume === "number" ? Math.min(1, Math.max(0, value.volume)) : base.volume
  };
});

export const instrument = computed(
  () => getPlayableInstrument(settings.instrumentId) ?? playableInstruments[0]
);

/** The tuning a fretted instrument is strung to; null for keyed ones. */
export const preset = computed(() => {
  const current = instrument.value;
  if (!isTuned(current)) return null;
  return getPreset(current, settings.presets[current.id] ?? current.tuning.defaultPresetId);
});

const performer = shallowRef<Performer | null>(null);
let lease: AudioEngineHandle | null = null;

function persist(): void {
  stored.write({ ...settings, presets: { ...settings.presets } });
}

export function hydratePlay(): void {
  Object.assign(settings, stored.read());
}

/**
 * The primary action is never disabled: playing a note acquires audio if
 * it has to.
 */
async function ensurePerformer(): Promise<Performer> {
  if (performer.value) return performer.value;
  lease = await acquireAudio();
  const player = createVoicePlayer(lease.context, lease.master, settings.volume);
  performer.value = createPerformer({
    player,
    now: () => lease!.context.currentTime,
    timbreId: instrument.value.timbre ?? "singable",
    tuning: analysisSettings.tuning
  });
  return performer.value;
}

export async function noteOn(midi: number, velocity = 0.8): Promise<void> {
  sounding.add(midi);
  const unit = await ensurePerformer();
  // The key may already have come back up while audio was starting.
  if (!sounding.has(midi)) return;
  unit.setTuning(analysisSettings.tuning);
  unit.noteOn(midi, velocity);
}

/** How long a struck pad stays lit; long enough to see, short enough to keep up. */
const FLASH_MS = 110;

/** Hit a kit piece. There is no note-off: a strike is over when it decays. */
export async function strike(pieceId: string): Promise<void> {
  const surface = instrument.value.surface;
  if (surface.kind !== "pads") return;
  const piece = surface.pieces.find((entry) => entry.id === pieceId);
  if (!piece) return;

  struck.add(piece.id);
  setTimeout(() => struck.delete(piece.id), FLASH_MS);

  const unit = await ensurePerformer();
  const voice = getTimbre(piece.timbre);
  unit.strike(
    timbreSpecAt(voice, piece.tone, voice.ring ?? 0.3),
    0.9,
    piece.choke
  );
}

export function noteOff(midi: number): void {
  sounding.delete(midi);
  performer.value?.noteOff(midi);
}

export function allNotesOff(): void {
  sounding.clear();
  struck.clear();
  performer.value?.allOff();
}

export function setInstrument(id: string): void {
  if (!getPlayableInstrument(id)) return;
  settings.instrumentId = id;
  // The whole surface changes under the fingers; anything down would hang.
  allNotesOff();
  const timbre = instrument.value.timbre;
  if (timbre) performer.value?.setTimbre(timbre);
  persist();
}

export function setPreset(id: string): void {
  const current = instrument.value;
  if (!isTuned(current)) return;
  settings.presets = { ...settings.presets, [current.id]: id };
  allNotesOff();
  persist();
}

export function setBaseMidi(value: number): void {
  settings.baseMidi = Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, value));
  allNotesOff();
  persist();
}

export function shiftOctave(delta: number): void {
  setBaseMidi(shiftBase(settings.baseMidi, delta));
}

export function setVolume(value: number): void {
  settings.volume = Math.min(1, Math.max(0, value));
  performer.value?.setVolume(settings.volume);
  persist();
}

export function releasePlay(): void {
  performer.value?.dispose();
  performer.value = null;
  sounding.clear();
  struck.clear();
  lease?.release();
  lease = null;
}
