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
import { getTimbre } from "../../../audio/timbre.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { storedJson } from "../../../lib/persist.js";
import {
  getPlayableInstrument,
  getPreset,
  isTuned,
  playableInstruments,
  type PlaySurface
} from "../../../instruments/index.js";
import {
  DEFAULT_BASE_MIDI,
  MAX_BASE_MIDI,
  MIN_BASE_MIDI,
  shiftBase
} from "../domain/keymap.js";
import { createPerformer, type Performer } from "../engine/performer.js";

export const DEFAULT_INSTRUMENT = "piano";

export type Orientation = "horizontal" | "vertical";

/** The kinds of surface, which is what a direction is a fact about. */
export type SurfaceKind = PlaySurface["kind"];

export interface PlaySettings {
  instrumentId: string;
  /**
   * Which way each kind of surface runs, as the player last left it.
   *
   * The preference belongs to the surface rather than to the app. A
   * player who wants their neck down and their keyboard across is asking
   * for exactly that, and one field cannot hold both — it would make
   * turning a guitar turn the piano with it.
   */
  orientations: Partial<Record<SurfaceKind, Orientation>>;
  /** Where the computer keyboard sits, for keyed instruments. */
  baseMidi: number;
  /** Chosen tuning per fretted instrument; the tuner's choice is its own. */
  presets: Record<string, string>;
  volume: number;
}

function defaults(): PlaySettings {
  return {
    instrumentId: DEFAULT_INSTRUMENT,
    orientations: {},
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

/** Anything that is not one of the two words is not a preference. */
function readOrientation(value: unknown): Orientation | undefined {
  return value === "vertical" || value === "horizontal" ? value : undefined;
}

/**
 * The stored preferences, including the single field this used to be.
 * One direction for the whole tool was read as a choice about necks,
 * because a neck was the only thing that had one.
 */
function readOrientations(value: unknown, legacy: unknown): Partial<Record<SurfaceKind, Orientation>> {
  const out: Partial<Record<SurfaceKind, Orientation>> = {};
  if (value && typeof value === "object") {
    for (const [kind, direction] of Object.entries(value as Record<string, unknown>)) {
      const read = readOrientation(direction);
      if (read) out[kind as SurfaceKind] = read;
    }
  }
  const older = readOrientation(legacy);
  if (older && out.frets === undefined) out.frets = older;
  return out;
}

const stored = storedJson<PlaySettings>("play", defaults, (raw, base) => {
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<PlaySettings> & {
    fretOrientation?: unknown;
    orientation?: unknown;
  };
  const baseMidi = typeof value.baseMidi === "number" ? value.baseMidi : base.baseMidi;
  return {
    // An instrument that no longer exists must not survive as a dead pick.
    instrumentId: getPlayableInstrument(String(value.instrumentId)) ? value.instrumentId! : base.instrumentId,
    // `fretOrientation` and then `orientation` are what this was called
    // while one field was thought to be enough. Read them, then they are
    // gone.
    orientations: readOrientations(value.orientations, value.orientation ?? value.fretOrientation),
    baseMidi: Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, Math.round(baseMidi / 12) * 12)),
    presets: value.presets && typeof value.presets === "object" ? { ...value.presets } : base.presets,
    volume: typeof value.volume === "number" ? Math.min(1, Math.max(0, value.volume)) : base.volume
  };
});

export const instrument = computed(
  () => getPlayableInstrument(settings.instrumentId) ?? playableInstruments[0]
);

/** Whether the window this session opened in is a narrow one. */
let narrowViewport = false;

/**
 * Where a surface runs before the player has said.
 *
 * Only a neck has a reason to differ, and it is the reason the rule
 * exists: sixteen frets across 390px are cells too small to hit. A
 * keyboard has no such constraint — turning it is not a rotation of the
 * same instrument but a different one — so everything else opens across
 * rather than inheriting a rule that was never about it.
 */
function defaultOrientation(kind: SurfaceKind): Orientation {
  if (kind !== "frets") return "horizontal";
  return narrowViewport ? "vertical" : "horizontal";
}

/** The direction the surface in front of the player runs. */
export const orientation = computed<Orientation>(() => {
  const kind = instrument.value.surface.kind;
  return settings.orientations[kind] ?? defaultOrientation(kind);
});

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

/** Below this a sixteen-fret row gives cells too small to hit. */
export const NARROW_SCREEN_PX = 720;

export function hydratePlay(viewportWidth?: number): void {
  Object.assign(settings, stored.read());
  if (viewportWidth !== undefined) narrowViewport = viewportWidth < NARROW_SCREEN_PX;
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
    context: lease.context,
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
  unit.strike(piece.timbre, piece.tone, 0.9, piece.choke);
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

export function setOrientation(value: Orientation): void {
  const kind = instrument.value.surface.kind;
  if (orientation.value === value) return;
  settings.orientations = { ...settings.orientations, [kind]: value };
  // The surface is rearranged under the fingers, so anything down would
  // hang: the key the player is holding is not where they left it.
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
