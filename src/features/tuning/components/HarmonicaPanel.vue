<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { midiToFrequency, NOTE_NAMES } from "../../../lib/music-theory.js";
import { formatCents } from "../../../lib/format.js";
import { useAnalysis } from "../../../composables/useAnalysis.js";
import { useI18n } from "../../../composables/useI18n.js";
import { useTuner } from "../stores/tuner.js";
import { stringStatus, type StringStatus, type TuningTarget } from "../../../instruments/index.js";
import { audioStore } from "../stores/audio.js";

const { t } = useI18n();
const tuner = useTuner();
const { pitch, tick } = useAnalysis();

/** Index of the expanded target, or null. */
const expanded = ref<number | null>(null);

interface CellDisplay {
  status: StringStatus;
  centsText: string;
  activeIndex: number | null;
  isAuto: boolean;
}

const display = reactive<CellDisplay[]>([]);
const positionDisplays = reactive<Array<{ status: StringStatus; centsText: string }>>([]);

const targets = computed(() => tuner.targets.value);

/** The grid is derived from the targets' slots, not hardcoded. */
const rows = computed(() => [...new Set(targets.value.map((target) => target.slot?.row ?? 0))].sort((a, b) => a - b));
const columns = computed(() => [...new Set(targets.value.map((target) => target.slot?.column ?? ""))]);

function indexAt(row: number, column: string): number {
  return targets.value.findIndex((target) => target.slot?.row === row && target.slot?.column === column);
}

function targetAt(row: number, column: string): TuningTarget | undefined {
  return targets.value[indexAt(row, column)];
}

function initCells(): void {
  display.splice(0, display.length);
  for (const _ of targets.value) {
    display.push({ status: "idle", centsText: "", activeIndex: null, isAuto: false });
  }
}

function syncDisplays(): void {
  const p = pitch.value;
  const hasSignal = Boolean(p && p.confidence >= 0.35);
  const confidence = p?.confidence ?? 0;
  const auto = tuner.autoMatch.value;
  const manual = tuner.selection.value;

  targets.value.forEach((target, index) => {
    const isAuto = auto?.targetIndex === index;
    const isManual = manual?.targetIndex === index;
    const activeIndex = isAuto ? auto!.positionIndex : isManual ? manual!.positionIndex : null;

    let cents = 0;
    if (isAuto) {
      cents = auto!.cents;
    } else if (isManual && p) {
      const midi = target.positions[manual!.positionIndex]?.midi ?? target.positions[0].midi;
      cents = 1200 * Math.log2(p.frequency / midiToFrequency(midi, audioStore.tuning));
    }
    const status = activeIndex == null ? "idle" : stringStatus(cents, hasSignal, confidence);
    const text = status === "idle" ? "" : formatCents(cents);

    const current = display[index];
    if (!current) return;
    if (
      current.status !== status ||
      current.centsText !== text ||
      current.activeIndex !== activeIndex ||
      current.isAuto !== isAuto
    ) {
      current.status = status;
      current.centsText = text;
      current.activeIndex = activeIndex;
      current.isAuto = isAuto;
    }
  });

  const target = expanded.value == null ? null : targets.value[expanded.value];
  if (target) {
    while (positionDisplays.length < target.positions.length) {
      positionDisplays.push({ status: "idle", centsText: "" });
    }
    target.positions.forEach((position, index) => {
      const frequency = midiToFrequency(position.midi, audioStore.tuning);
      const cents = p ? 1200 * Math.log2(p.frequency / frequency) : 0;
      const status = stringStatus(cents, hasSignal, confidence);
      const text = status === "idle" ? "" : formatCents(cents);
      if (positionDisplays[index].status !== status || positionDisplays[index].centsText !== text) {
        positionDisplays[index].status = status;
        positionDisplays[index].centsText = text;
      }
    });
  }
}

// Clicking a cell both expands its positions and pins it as the tuner
// target (the plain note, position 0); clicking it again releases the
// target back to auto-follow.
function toggleCell(index: number): void {
  if (expanded.value === index) {
    expanded.value = null;
    tuner.clearSelection();
  } else {
    expanded.value = index;
    tuner.selectTarget(index, 0);
  }
  syncDisplays();
}

function positionKindText(kind: string, bendLevel?: number): string {
  if (kind === "bend") {
    return t((bendLevel ?? 0) >= 3 ? "tuner.kind.deepBend" : "tuner.kind.bend", { level: bendLevel ?? 0 });
  }
  return t(`tuner.kind.${kind}`);
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

watch(
  targets,
  () => {
    expanded.value = null;
    initCells();
    syncDisplays();
  },
  { immediate: true }
);

watch(tick, syncDisplays);
</script>

<template>
  <div class="harmonica">
    <div class="harmonica-grid" :aria-label="t('tunerSelectTuning')">
      <div class="harmonica-grid-head">#</div>
      <div v-for="column in columns" :key="column" class="harmonica-grid-head">
        {{ t(`tuner.kind.${column}`) }}
      </div>

      <template v-for="row in rows" :key="row">
        <div class="harmonica-hole-label">{{ row }}</div>
        <div
          v-for="column in columns"
          :key="column"
          class="harmonica-cell"
          role="button"
          :tabindex="0"
          :class="[
            `st-${display[indexAt(row, column)]?.status ?? 'idle'}`,
            {
              'is-auto': tuner.autoMode.value && display[indexAt(row, column)]?.isAuto,
              'is-expanded': expanded === indexAt(row, column)
            }
          ]"
          @click="toggleCell(indexAt(row, column))"
          @keydown.enter.prevent="toggleCell(indexAt(row, column))"
          @keydown.space.prevent="toggleCell(indexAt(row, column))"
        >
          <span class="cell-note">
            {{ noteName(targetAt(row, column)?.positions[0]?.midi ?? 0) }}
          </span>
          <span v-if="(display[indexAt(row, column)]?.activeIndex ?? 0) > 0" class="cell-badge">
            {{
              positionKindText(
                targetAt(row, column)?.positions[display[indexAt(row, column)].activeIndex ?? 0]?.kind ?? '',
                targetAt(row, column)?.positions[display[indexAt(row, column)].activeIndex ?? 0]?.bendLevel
              )
            }}
          </span>
          <span v-if="display[indexAt(row, column)]?.centsText" class="cell-cents">
            {{ display[indexAt(row, column)]?.centsText }}
          </span>
        </div>
      </template>
    </div>

    <div v-if="expanded !== null && targets[expanded]" class="harmonica-expand">
      <p class="expand-title">
        {{ t("tunerHole", { hole: targets[expanded].slot?.row ?? 0 }) }} ·
        {{ t(`tuner.kind.${targets[expanded].slot?.column ?? "blow"}`) }} ·
        {{ t("tunerExpand") }}
      </p>
      <div class="position-chips">
        <button
          v-for="(position, index) in targets[expanded].positions"
          :key="index"
          class="position-chip"
          :class="[
            `st-${positionDisplays[index]?.status ?? 'idle'}`,
            { 'is-selected': tuner.selection.value?.targetIndex === expanded && tuner.selection.value?.positionIndex === index }
          ]"
          @click="tuner.selectTarget(expanded, index)"
        >
          <span class="chip-kind">{{ positionKindText(position.kind, position.bendLevel) }}</span>
          <span class="chip-note">{{ noteName(position.midi) }}</span>
          <span class="chip-cents">{{ positionDisplays[index]?.centsText ?? "" }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
