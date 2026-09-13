/**
 * Recordings, for when the player would rather hear the instrument than a
 * model of it.
 *
 * The bank is FluidR3_GM, pre-rendered by `gleitz/midi-js-soundfonts` as
 * one JavaScript file per program: a map of note names to base64 MP3 data
 * URIs. It is fetched from where it is published rather than vendored into
 * this repository. That is not laziness — it is CC BY 3.0 material, and a
 * copy in an MIT repository is a licensing question nobody wants to
 * answer, while a runtime fetch with attribution answers it by
 * construction.
 *
 * Nothing is decoded until it is needed. The file is 2.6MB and holds
 * eighty-eight notes; decoding all of them to play one is a second of
 * silence for the sake of notes nobody asked for. So the text is fetched
 * once, the notes are kept as they arrived, and a note is decoded the
 * first time somebody plays it.
 *
 * Decoding needs an `AudioContext`, which arrives long after this module
 * does, so everything here is a function of the context rather than of the
 * module. `lib/` never sees any of it.
 */

import { LOUDNESS, PEAK_CEILING, LOUDNESS_WINDOW } from "./render.js";

const BANK = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM";

/** The name a program is published under, and where it comes from. */
export const SOUNDFONT_CREDIT = {
  name: "FluidR3_GM",
  url: "https://github.com/gleitz/midi-js-soundfonts"
};

interface Bank {
  /** Note names as they arrive, in the file's own spelling (`Bb0`, `Db1`). */
  encoded: Map<number, string>;
  /** Decoded notes, by MIDI number. */
  decoded: Map<number, AudioBuffer>;
  loading: Promise<void> | null;
  loaded: boolean;
}

const banks = new Map<string, Bank>();

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * `C4` is 60. The bank spells every black key with a flat — `Bb0`, `Db1` —
 * and this reads both spellings so a file that ever changes its mind
 * still loads.
 */
export function midiFromName(name: string): number | null {
  const match = /^([A-G])([b#]?)(-?\d+)$/.exec(name);
  if (!match) return null;
  const base = LETTERS[match[1]];
  if (base === undefined) return null;
  const accidental = match[2] === "b" ? -1 : match[2] === "#" ? 1 : 0;
  return (Number(match[3]) + 1) * 12 + base + accidental;
}

function bankOf(name: string): Bank {
  let bank = banks.get(name);
  if (!bank) {
    bank = { encoded: new Map(), decoded: new Map(), loading: null, loaded: false };
    banks.set(name, bank);
  }
  return bank;
}

/**
 * Fetch a program. Resolves when its notes are known, not when they are
 * decoded — the caller can play as soon as it has one.
 */
export function preload(context: BaseAudioContext, name: string): Promise<void> {
  const bank = bankOf(name);
  if (bank.loaded) return Promise.resolve();
  if (bank.loading) return bank.loading;

  bank.loading = (async () => {
    try {
      const response = await fetch(`${BANK}/${name}-mp3.js`);
      if (!response.ok) throw new Error(`soundfont ${name}: ${response.status}`);
      const source = await response.text();
      // The file assigns an object literal of `"C4": "data:audio/mp3;base64,…"`.
      for (const match of source.matchAll(/"([A-G][b#]?-?\d+)":\s*"(data:audio\/[^;]+;base64,[^"]+)"/g)) {
        const midi = midiFromName(match[1]);
        if (midi !== null) bank.encoded.set(midi, match[2]);
      }
      bank.loaded = bank.encoded.size > 0;
      if (!bank.loaded) throw new Error(`soundfont ${name}: no notes in the file`);
    } catch (error) {
      // A bank that will not load is not an error the player needs to see:
      // the model still plays, and the tier is a preference rather than a
      // promise. Forgetting the promise lets a later attempt try again.
      bank.loading = null;
      void context;
      throw error;
    }
  })();

  return bank.loading;
}

/** Whether a program is ready enough to play without waiting. */
export function isLoaded(name: string): boolean {
  return bankOf(name).loaded;
}

function decodeBase64(context: BaseAudioContext, data: string): Promise<AudioBuffer> {
  const comma = data.indexOf(",");
  const binary = atob(data.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return context.decodeAudioData(bytes.buffer);
}

/**
 * A recording of one note, decoded on first use.
 *
 * The nearest recorded note is used when the exact one is missing, and the
 * caller is told how far away it is so it can be played at the right
 * speed. A piano is sampled in minor thirds, so "the nearest" is a few
 * semitones, and one note resampled by three semitones is a far smaller
 * lie than a model is.
 */
export interface SampledNote {
  buffer: AudioBuffer;
  /** Semitones between what was asked for and what was recorded. */
  offset: number;
  /**
   * What the recording has to be multiplied by to sit at the same level
   * as a model of the same instrument.
   *
   * Without this the two tiers are fifteen decibels apart, because a
   * model is calibrated to a loudness and a bank is whatever level
   * somebody encoded it at. That would be merely a mixing question if the
   * tiers were alternatives — but the hybrid tier plays both at once, and
   * an attack layer fifteen decibels under the note it is attacking is an
   * attack layer nobody hears.
   */
  gain: number;
}

/**
 * Where a recording sits, measured the way a model is.
 *
 * Zero means the recording is not a note at all, and a bank does contain
 * those: FluidR3's contrabass has a C4 that is three seconds of silence,
 * which is outside the instrument and was never played. Scaling silence
 * up is still silence, so the caller is told and falls back to the model
 * — which is the difference between an instrument that sounds like a
 * double bass and one that sounds like nothing.
 */
export function loudnessGain(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const window = Math.min(data.length, Math.max(1, Math.round(LOUDNESS_WINDOW * buffer.sampleRate)));
  let sum = 0;
  let peak = 0;
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index];
    if (index < window) sum += value * value;
    const size = Math.abs(value);
    if (size > peak) peak = size;
  }
  const rms = Math.sqrt(sum / window);
  if (rms < 1e-4 || peak <= 0) return 0;
  // The same two limits a model is brought to: loudness for the level, a
  // ceiling for the transient. A recording scaled to a loudness alone
  // would clip its own attack.
  return Math.min(20, Math.max(0.1, Math.min(LOUDNESS / rms, PEAK_CEILING / peak)));
}

export async function sampleFor(
  context: BaseAudioContext,
  name: string,
  midi: number
): Promise<SampledNote | null> {
  const bank = bankOf(name);
  if (!bank.loaded) {
    try {
      await preload(context, name);
    } catch (_) {
      return null;
    }
  }

  let nearest: number | null = null;
  for (const candidate of bank.encoded.keys()) {
    if (nearest === null || Math.abs(candidate - midi) < Math.abs(nearest - midi)) nearest = candidate;
  }
  if (nearest === null) return null;

  return usable(bank.decoded.get(nearest), nearest - midi) ?? (await decode(context, bank, nearest, midi));
}

/** The note, if what came back is a note. */
function usable(buffer: AudioBuffer | undefined, offset: number): SampledNote | null {
  if (!buffer) return null;
  const gain = loudnessGain(buffer);
  return gain > 0 ? { buffer, offset, gain } : null;
}

async function decode(
  context: BaseAudioContext,
  bank: Bank,
  nearest: number,
  midi: number
): Promise<SampledNote | null> {
  const data = bank.encoded.get(nearest);
  if (!data) return null;
  try {
    const buffer = await decodeBase64(context, data);
    bank.decoded.set(nearest, buffer);
    return usable(buffer, nearest - midi);
  } catch (_) {
    return null;
  }
}

/**
 * Decode a whole program, in the background.
 *
 * Nothing here can wait for a network round trip in the middle of a note,
 * so the notes are decoded up front and played from memory. Every one of
 * them: eighty-eight MP3s is under a second of decoding, and decoding the
 * ones nobody plays costs less than a stutter on the ones they do.
 */
export async function prepare(context: BaseAudioContext, name: string): Promise<void> {
  try {
    await preload(context, name);
  } catch (_) {
    return;
  }
  const bank = bankOf(name);
  for (const midi of [...bank.encoded.keys()]) {
    if (bank.decoded.has(midi)) continue;
    const data = bank.encoded.get(midi);
    if (!data) continue;
    try {
      bank.decoded.set(midi, await decodeBase64(context, data));
    } catch (_) {
      // One note that will not decode is one note the model covers.
    }
  }
}

/**
 * The recording for a note, if it has been decoded. Never waits: a note
 * presses now, and a note that had to be fetched first is a note that
 * arrived late under the player's finger.
 */
export function sampleNow(name: string, midi: number): SampledNote | null {
  const bank = banks.get(name);
  if (!bank || bank.decoded.size === 0) return null;

  let nearest: number | null = null;
  for (const candidate of bank.decoded.keys()) {
    if (nearest === null || Math.abs(candidate - midi) < Math.abs(nearest - midi)) nearest = candidate;
  }
  if (nearest === null) return null;
  return usable(bank.decoded.get(nearest), nearest - midi);
}

/*
 * The drum kit.
 *
 * A General MIDI bank has no percussion: its channel ten is a mapping,
 * not a program, and the pre-rendered collections leave it out entirely —
 * so the kit needs a set of recordings of its own rather than a name in
 * the same bank as everything else. Teropa's drumkit is nine files that
 * happen to be the nine pieces this kit has, which is a coincidence worth
 * taking.
 */
export const DRUMKIT_CREDIT = {
  name: "@teropa/drumkit",
  url: "https://github.com/teropa/drumkit"
};

const DRUMS = "https://cdn.jsdelivr.net/npm/@teropa/drumkit@1.1.0/dist/assets";

const kit = { decoded: new Map<string, AudioBuffer>(), loading: null as Promise<void> | null };

/** Fetch every piece at once. They are 120KB between them. */
export function preloadPercussion(context: BaseAudioContext): Promise<void> {
  if (kit.decoded.size > 0) return Promise.resolve();
  if (kit.loading) return kit.loading;

  kit.loading = (async () => {
    try {
      const names = [...new Set(DRUM_PIECES)];
      await Promise.all(
        names.map(async (name) => {
          const response = await fetch(`${DRUMS}/${name}.mp3`);
          if (!response.ok) return;
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          kit.decoded.set(name, buffer);
        })
      );
    } catch (_) {
      // A kit that will not load is a kit the model covers.
    }
    if (kit.decoded.size === 0) kit.loading = null;
  })();

  return kit.loading;
}

/** Which files the kit is made of. Kept here so the loader fetches once. */
let DRUM_PIECES: string[] = [];

/** Tell the loader which pieces to ask for. Called once, from the data. */
export function declarePieces(names: string[]): void {
  DRUM_PIECES = names;
}

/** A piece, if the kit has arrived. Never waits. */
export function percussionNow(name: string): SampledNote | null {
  const buffer = kit.decoded.get(name);
  if (!buffer) return null;
  const gain = loudnessGain(buffer);
  return gain > 0 ? { buffer, offset: 0, gain } : null;
}

/** Forget every fetched bank. Used when the context that decoded them goes. */
export function clearSoundfonts(): void {
  banks.clear();
  kit.decoded.clear();
  kit.loading = null;
}

/** How many notes of a program are decoded. For tests and diagnostics. */
export function decodedCount(name: string): number {
  return bankOf(name).decoded.size;
}
