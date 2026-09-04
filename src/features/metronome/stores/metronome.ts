/**
 * Metronome state: everything the UI binds to, plus the wiring to the
 * transport.
 *
 * The audio clock is the master. Vue never triggers a sound — the store
 * hands the transport a pattern snapshot once per bar, and a rAF loop
 * pulls the currently sounding beat back out for the display. Settings
 * are persisted so a practice session survives a reload.
 */

import { reactive, shallowRef, watch } from "vue";
import {
  makeMeter,
  meterPulses,
  metersEqual,
  type Denominator,
  type Meter
} from "../domain/meter.js";
import { defaultAccents, nextAccent, resizeAccents, type Accent } from "../domain/accent.js";
import { clampBpm, pulseSeconds, tapTempo, type Tempo } from "../domain/tempo.js";
import type { RhythmPattern } from "../domain/rhythm.js";
import { defaultPractice, practiceForBar, type PracticeConfig } from "../domain/practice.js";
import { DEFAULT_BANK_ID, SOUND_BANKS, type SoundBankId } from "../engine/sound-bank.js";
import { createMetronomeTransport } from "../engine/native-transport.js";
import type { ClickTransport } from "../engine/native-transport.js";
import { storedJson } from "../../../lib/persist.js";

export interface MetronomeState {
  bpm: number;
  beatUnit: Denominator;
  meter: Meter;
  accents: Accent[];
  divisions: number;
  /** 0..1 */
  swing: number;
  polyrhythm: number;
  bankId: SoundBankId;
  volume: number;
  practice: PracticeConfig;
  running: boolean;
  /** BPM actually sounding — differs from `bpm` while the ramp runs. */
  effectiveBpm: number;
}

function initialState(): MetronomeState {
  const meter = makeMeter(4, [1, 1, 1, 1]);
  return {
    bpm: 120,
    beatUnit: 4,
    meter,
    accents: defaultAccents(meter),
    divisions: 1,
    swing: 0,
    polyrhythm: 0,
    bankId: DEFAULT_BANK_ID,
    volume: 0.8,
    practice: defaultPractice(),
    running: false,
    effectiveBpm: 120
  };
}

const stored = storedJson<MetronomeState>(
  "metronome",
  initialState,
  (raw, state) => {
    const saved = raw as Partial<MetronomeState>;
    if (typeof saved.bpm === "number") state.bpm = clampBpm(saved.bpm);
    if (saved.beatUnit) state.beatUnit = saved.beatUnit;
    if (saved.meter?.groups?.length) {
      state.meter = makeMeter(saved.meter.denominator, saved.meter.groups);
    }
    state.accents = resizeAccents(saved.accents ?? [], state.meter);
    if (typeof saved.divisions === "number") state.divisions = saved.divisions;
    if (typeof saved.swing === "number") state.swing = saved.swing;
    if (typeof saved.polyrhythm === "number") state.polyrhythm = saved.polyrhythm;
    if (SOUND_BANKS.some((bank) => bank.id === saved.bankId)) state.bankId = saved.bankId!;
    if (typeof saved.volume === "number") state.volume = saved.volume;
    if (saved.practice) state.practice = { ...state.practice, ...saved.practice };
    state.effectiveBpm = state.bpm;
    return state;
  },
  "tcl-metronome"
);

export const metronome = reactive<MetronomeState>(stored.read());

/** Beat highlighted in the grid; shallow so the rAF loop stays cheap. */
export const activeBeat = shallowRef<{ pulse: number; tick: number; voice: string; bar: number } | null>(
  null
);
/** Bars completed since the transport started. */
export const barCounter = shallowRef(0);

let transport: ClickTransport | null = null;
let rafId = 0;

function persist(): void {
  // Transport state (running / the live ramp) is a session fact, not a setting.
  const { running, effectiveBpm, ...settings } = metronome;
  void running;
  void effectiveBpm;
  stored.write(settings as MetronomeState);
}

export function currentPattern(): RhythmPattern {
  return {
    meter: metronome.meter,
    accents: metronome.accents,
    subdivision: { divisions: metronome.divisions, swing: metronome.swing },
    polyrhythm: metronome.polyrhythm
  };
}

export function tempo(): Tempo {
  return { bpm: metronome.effectiveBpm || metronome.bpm, beatUnit: metronome.beatUnit };
}

/**
 * Once per bar: practice mode picks this bar's tempo and whether it is
 * silent, and the bar's meter is locked in. Its dice are rolled here, not
 * per event.
 */
function startBar(barIndex: number) {
  const plan = practiceForBar(metronome.practice, barIndex, metronome.bpm, Math.random);
  metronome.effectiveBpm = plan.bpm;
  return { meter: metronome.meter, silent: plan.silent };
}

/** Live pulse length, read per event so a tempo change lands immediately. */
function livePulseSeconds(meter: Meter): number {
  return pulseSeconds({ bpm: metronome.effectiveBpm || metronome.bpm, beatUnit: metronome.beatUnit }, meter);
}

function followAudioClock(): void {
  rafId = window.requestAnimationFrame(followAudioClock);
  if (!transport) return;
  const beat = transport.currentAt(transport.now());
  if (!beat) return;
  const current = activeBeat.value;
  if (
    !current ||
    current.pulse !== beat.event.pulse ||
    current.tick !== beat.event.tick ||
    current.bar !== beat.barIndex ||
    current.voice !== beat.event.voice
  ) {
    activeBeat.value = {
      pulse: beat.event.pulse,
      tick: beat.event.tick,
      voice: beat.event.voice,
      bar: beat.barIndex
    };
    barCounter.value = beat.barIndex;
  }
}

export async function start(): Promise<void> {
  if (metronome.running) return;
  transport = createMetronomeTransport({
    startBar,
    pattern: currentPattern,
    pulseSeconds: livePulseSeconds,
    bankId: metronome.bankId,
    volume: metronome.volume
  });
  await transport.start();
  metronome.running = true;
  followAudioClock();
}

export function stop(): void {
  if (transport) {
    transport.dispose();
    transport = null;
  }
  window.cancelAnimationFrame(rafId);
  rafId = 0;
  metronome.running = false;
  metronome.effectiveBpm = metronome.bpm;
  activeBeat.value = null;
  barCounter.value = 0;
}

export async function toggle(): Promise<void> {
  if (metronome.running) stop();
  else await start();
}

export function setBpm(bpm: number): void {
  metronome.bpm = clampBpm(bpm);
  if (!metronome.practice.rampEnabled) metronome.effectiveBpm = metronome.bpm;
}

export function nudgeBpm(delta: number): void {
  setBpm(metronome.bpm + delta);
}

export function setMeter(meter: Meter): void {
  if (metersEqual(metronome.meter, meter)) return;
  metronome.meter = meter;
  metronome.accents = resizeAccents(metronome.accents, meter);
}

export function setGroups(groups: number[]): void {
  setMeter(makeMeter(metronome.meter.denominator, groups));
}

export function setBeatUnit(unit: Denominator): void {
  metronome.beatUnit = unit;
}

export function cycleAccentAt(pulse: number): void {
  const accents = [...metronome.accents];
  if (pulse < 0 || pulse >= accents.length) return;
  accents[pulse] = nextAccent(accents[pulse]);
  metronome.accents = accents;
}

export function resetAccents(): void {
  metronome.accents = defaultAccents(metronome.meter);
}

export function setBank(id: SoundBankId): void {
  metronome.bankId = id;
  transport?.setBank(id);
}

export function setVolume(value: number): void {
  metronome.volume = value;
  transport?.setVolume(value);
}

export function pulseCount(): number {
  return meterPulses(metronome.meter);
}

// --- Tap tempo ---

let taps: number[] = [];

export function tap(): number | null {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  taps = [...taps, now].slice(-8);
  const bpm = tapTempo(taps);
  if (bpm != null) setBpm(bpm);
  return bpm;
}

export function resetTaps(): void {
  taps = [];
}

watch(
  () => JSON.stringify({ ...metronome, running: false, effectiveBpm: 0 }),
  () => persist()
);
