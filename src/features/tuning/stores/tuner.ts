/**
 * Tuner session state: which instrument, tuning and layout variant are
 * selected, which target the needle follows, and the detector band.
 *
 * There is one selection concept, not two: a guitar string and a harmonica
 * bend are both `{ targetIndex, positionIndex }`, so auto-follow, manual
 * pinning and the needle are written once for every instrument.
 */

import { computed, ref, watch } from "vue";
import {
  buildTargets,
  deriveRange,
  getTunedInstrument,
  getPreset,
  getVariant,
  nearestTarget,
  type TargetMatch
} from "../../../instruments/index.js";
import { midiToFrequency } from "../../../lib/music-theory.js";
import { pitchRef, setDetectorRange } from "../../../audio/analysis.js";
import { storedJson, storedString } from "../../../lib/persist.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { clearReference, publishReference } from "../../../shared/stores/reference.js";

/** Below this confidence the display reads as idle. */
const CONFIDENCE_FLOOR = 0.35;

const DEFAULT_INSTRUMENT = "guitar";

interface InstrumentChoice {
  preset?: string;
  variant?: string;
}

/** Per-instrument tuning + variant, in one record instead of 2N keys. */
const storedChoices = storedJson<Record<string, InstrumentChoice>>(
  "tuner.choices",
  () => ({}),
  (raw, base) => {
    if (!raw || typeof raw !== "object") return base;
    const result: Record<string, InstrumentChoice> = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const choice = value as InstrumentChoice;
      result[id] = {
        preset: typeof choice.preset === "string" ? choice.preset : undefined,
        variant: typeof choice.variant === "string" ? choice.variant : undefined
      };
    }
    return result;
  }
);

const storedInstrument = storedString("tuner.instrument", DEFAULT_INSTRUMENT, "tcl-tuner-instrument");
const storedAuto = storedString("tuner.auto", "1", "tcl-tuner-auto");

const instrumentId = ref(DEFAULT_INSTRUMENT);
const presetId = ref("");
const variantId = ref("");
const autoMode = ref(true);
let choices: Record<string, InstrumentChoice> = {};

/** Manually pinned target; null means follow the detected pitch. */
const selection = ref<{ targetIndex: number; positionIndex: number } | null>(null);
/** Auto-detected target (only while confident and auto-follow is on). */
const autoMatch = ref<TargetMatch | null>(null);

export const instrument = computed(() => getTunedInstrument(instrumentId.value));
export const preset = computed(() =>
  instrument.value ? getPreset(instrument.value, presetId.value) : null
);
export const variant = computed(() =>
  instrument.value ? getVariant(instrument.value, variantId.value) : null
);

/** Everything playable in the current tuning, in display order. */
export const targets = computed(() => {
  const current = instrument.value;
  if (!current || !preset.value) return [];
  return buildTargets(current, preset.value, variant.value?.reeds);
});

/** Read persisted state. Called by the view, so importing has no effect. */
export function hydrateTuner(): void {
  choices = storedChoices.read();
  const storedId = storedInstrument.read();
  instrumentId.value = getTunedInstrument(storedId) ? storedId : DEFAULT_INSTRUMENT;
  autoMode.value = storedAuto.read() === "1";
  applyChoice(instrumentId.value);
}

function applyChoice(id: string): void {
  const next = getTunedInstrument(id);
  if (!next) return;
  const choice = choices[id] ?? {};
  presetId.value = choice.preset ?? next.tuning.defaultPresetId;
  variantId.value = choice.variant ?? next.tuning.defaultVariantId ?? "";
  resetTargets();
}

function rememberChoice(): void {
  choices = {
    ...choices,
    [instrumentId.value]: { preset: presetId.value, variant: variantId.value || undefined }
  };
  storedChoices.write(choices);
}

export function setInstrument(id: string): void {
  const next = getTunedInstrument(id);
  if (!next) return;
  instrumentId.value = id;
  storedInstrument.write(id);
  applyChoice(id);
  setDetectorRange(deriveRange(next));
}

export function setPreset(id: string): void {
  presetId.value = id;
  rememberChoice();
  resetTargets();
}

export function setVariant(id: string): void {
  variantId.value = id;
  rememberChoice();
  resetTargets();
}

export function toggleAuto(): void {
  autoMode.value = !autoMode.value;
  storedAuto.write(autoMode.value ? "1" : "0");
}

/** Pin a target (position 0 is its standard pitch). */
export function selectTarget(targetIndex: number, positionIndex = 0): void {
  const target = targets.value[targetIndex];
  if (!target?.positions[positionIndex]) return;
  selection.value = { targetIndex, positionIndex };
}

/** Drop the manual target and fall back to auto-follow. */
export function clearSelection(): void {
  selection.value = null;
}

function resetTargets(): void {
  selection.value = null;
  autoMatch.value = null;
}

/** Activate the tuner for this instrument (sets the detector band). */
export function activateTuner(): void {
  if (instrument.value) setDetectorRange(deriveRange(instrument.value));
}

/** Leave the tuner: restore the default detector band. */
export function deactivateTuner(): void {
  setDetectorRange(null);
  clearReference();
}

// Publish whatever is being tuned, so other tools (the trace) can draw it
// without either feature knowing about the other.
watch(
  () => {
    const active = selection.value ?? autoMatch.value;
    if (!active) return null;
    const target = targets.value[active.targetIndex];
    const position = target?.positions[active.positionIndex];
    return target && position ? { midi: position.midi, label: target.label } : null;
  },
  (value) => publishReference(value),
  { immediate: true }
);

// Auto-detect: follow the nearest target while the user hasn't pinned one.
watch(pitchRef, (pitch) => {
  if (!pitch || pitch.confidence < CONFIDENCE_FLOOR || !autoMode.value || !targets.value.length) {
    autoMatch.value = null;
    return;
  }
  autoMatch.value = nearestTarget(pitch.frequency, targets.value, analysisSettings.tuning);
});

/** The target the big needle shows: the pinned one, else the detected one. */
export const needleTarget = computed(() => {
  const pitch = pitchRef.value;
  if (!pitch || pitch.confidence < CONFIDENCE_FLOOR) return null;

  const active = selection.value ?? autoMatch.value;
  if (!active) return null;

  const target = targets.value[active.targetIndex];
  const position = target?.positions[active.positionIndex];
  if (!target || !position) return null;

  return {
    targetIndex: active.targetIndex,
    positionIndex: active.positionIndex,
    target,
    position,
    midi: position.midi,
    label: target.label,
    frequency: pitch.frequency,
    confidence: pitch.confidence,
    cents: 1200 * Math.log2(pitch.frequency / midiToFrequency(position.midi, analysisSettings.tuning))
  };
});

export function useTuner() {
  return {
    instrumentId,
    presetId,
    variantId,
    autoMode,
    instrument,
    preset,
    variant,
    targets,
    selection,
    autoMatch,
    needleTarget,
    setInstrument,
    setPreset,
    setVariant,
    toggleAuto,
    selectTarget,
    clearSelection,
    activateTuner,
    deactivateTuner,
    hydrateTuner
  };
}
