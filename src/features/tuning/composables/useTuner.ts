/**
 * Tuner session state: instrument/tuning selection (persisted), the active
 * target (string or harmonica position), auto-detect matching, and the
 * detector-range lifecycle for the analysis loop.
 */

import { computed, ref, watch } from "vue";
import {
  getInstrument,
  getPreset,
  nearestString,
  nearestPosition,
  buildHarmonicaCells,
  type Breath,
  type NearestPositionResult
} from "../../../instruments/index.js";
import { midiToFrequency } from "../../../lib/music-theory.js";
import { pitchRef, setDetectorRange } from "../../../lib/analysis-loop.js";
import { audioStore } from "../stores/audio.js";

const STORAGE_INSTRUMENT = "tcl-tuner-instrument";
const STORAGE_AUTO = "tcl-tuner-auto";

function loadStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function saveStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // Persistence is best-effort.
  }
}

const instrumentId = ref(loadStored(STORAGE_INSTRUMENT, "guitar"));
if (!getInstrument(instrumentId.value)) {
  instrumentId.value = "guitar";
}

const presetId = ref(
  loadStored(`tcl-tuner-preset-${instrumentId.value}`, getInstrument(instrumentId.value)!.defaultPresetId)
);
const autoMode = ref(loadStored(STORAGE_AUTO, "1") === "1");

/** Manually selected target. */
const activeString = ref<number | null>(null);
const activeCell = ref<{
  hole: number;
  breath: Breath;
  positionIndex: number;
  midi: number;
} | null>(null);

/** Auto-detect results (confidence >= 0.35 only). */
const autoString = ref<number | null>(null);
const autoMatch = ref<(NearestPositionResult & { positionIndex: number }) | null>(null);

export const instrument = computed(() => getInstrument(instrumentId.value));
export const preset = computed(() =>
  instrument.value ? getPreset(instrument.value, presetId.value) : null
);

export const harmonicaCells = computed(() => {
  const layout = instrument.value?.harmonica;
  if (!layout || !preset.value) return [];
  const root = preset.value.notes[0] - layout.blowOffsets[0];
  return buildHarmonicaCells(layout, root);
});

function setInstrument(id: string): void {
  const next = getInstrument(id);
  if (!next) return;
  instrumentId.value = id;
  saveStored(STORAGE_INSTRUMENT, id);
  presetId.value = loadStored(`tcl-tuner-preset-${id}`, next.defaultPresetId);
  setDetectorRange(next.range);
  resetTargets();
}

function setPreset(id: string): void {
  presetId.value = id;
  saveStored(`tcl-tuner-preset-${instrumentId.value}`, id);
  resetTargets();
}

function toggleAuto(): void {
  autoMode.value = !autoMode.value;
  saveStored(STORAGE_AUTO, autoMode.value ? "1" : "0");
}

function selectString(index: number): void {
  activeString.value = index;
  activeCell.value = null;
}

function selectPosition(hole: number, breath: Breath, positionIndex: number): void {
  const cell = harmonicaCells.value.find(
    (candidate) => candidate.hole === hole && candidate.breath === breath
  );
  const position = cell?.positions[positionIndex];
  if (!position) return;
  activeCell.value = { hole, breath, positionIndex, midi: position.midi };
  activeString.value = null;
}

/** Drop the manual target and fall back to auto-follow. */
function clearSelection(): void {
  activeString.value = null;
  activeCell.value = null;
}

function resetTargets(): void {
  activeString.value = null;
  activeCell.value = null;
  autoString.value = null;
  autoMatch.value = null;
}

/** Activate the tuner for this instrument (sets the detector band). */
export function activateTuner(): void {
  const next = instrument.value;
  if (next) setDetectorRange(next.range);
}

/** Leave the tuner: restore the default detector band. */
export function deactivateTuner(): void {
  setDetectorRange(null);
}

// Auto-detect: match the live pitch to the nearest string or (hole ×
// breath × position), following the target while the user hasn't picked
// one manually.
watch(pitchRef, (pitch) => {
  const instr = instrument.value;
  const pr = preset.value;
  const confident = Boolean(pitch && pitch.confidence >= 0.35);

  if (!confident || !instr || !pr || !autoMode.value) {
    autoString.value = null;
    autoMatch.value = null;
    return;
  }

  if (instr.layout === "strings") {
    const match = nearestString(pitch!.frequency, pr.notes, audioStore.tuning);
    autoString.value = match ? match.index : null;
    return;
  }

  const match = nearestPosition(pitch!.frequency, harmonicaCells.value, audioStore.tuning);
  if (!match) {
    autoMatch.value = null;
    return;
  }
  const cell = harmonicaCells.value.find(
    (candidate) => candidate.hole === match.hole && candidate.breath === match.breath
  );
  const positionIndex = cell ? cell.positions.indexOf(match.position) : -1;
  autoMatch.value = { ...match, positionIndex };
});

/** The big-needle target: manual selection, else the auto-detected one. */
export const needleTarget = computed(() => {
  const pitch = pitchRef.value;
  const instr = instrument.value;
  const pr = preset.value;
  if (!pitch || pitch.confidence < 0.35 || !instr || !pr) return null;

  if (instr.layout === "strings") {
    const index = activeString.value ?? autoString.value;
    if (index == null || !Number.isFinite(pr.notes[index])) return null;
    const midi = pr.notes[index];
    const target = midiToFrequency(midi, audioStore.tuning);
    return {
      midi,
      frequency: pitch.frequency,
      confidence: pitch.confidence,
      cents: 1200 * Math.log2(pitch.frequency / target),
      label: pr.noteLabels?.[index] ?? null
    };
  }

  const selection = activeCell.value
    ? { hole: activeCell.value.hole, breath: activeCell.value.breath, positionIndex: activeCell.value.positionIndex, midi: activeCell.value.midi }
    : autoMatch.value
      ? { hole: autoMatch.value.hole, breath: autoMatch.value.breath, positionIndex: autoMatch.value.positionIndex, midi: autoMatch.value.position.midi }
      : null;
  if (!selection) return null;

  const cell = harmonicaCells.value.find(
    (candidate) => candidate.hole === selection.hole && candidate.breath === selection.breath
  );
  const position = cell?.positions[selection.positionIndex];
  const target = midiToFrequency(selection.midi, audioStore.tuning);
  return {
    midi: selection.midi,
    frequency: pitch.frequency,
    confidence: pitch.confidence,
    cents: 1200 * Math.log2(pitch.frequency / target),
    position: position ?? null,
    hole: selection.hole,
    breath: selection.breath
  };
});

export function useTuner() {
  return {
    instrumentId,
    presetId,
    autoMode,
    instrument,
    preset,
    harmonicaCells,
    activeString,
    activeCell,
    autoString,
    autoMatch,
    needleTarget,
    setInstrument,
    setPreset,
    toggleAuto,
    selectString,
    selectPosition,
    clearSelection,
    activateTuner,
    deactivateTuner
  };
}
