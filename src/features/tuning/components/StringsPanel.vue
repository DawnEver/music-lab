<script setup lang="ts">
import { analysisSettings } from "../../../audio/analysis.js";
import { computed, reactive, watch } from "vue";
import { midiToFrequency, NOTE_NAMES } from "../../../lib/music-theory.js";
import { formatCents } from "../../../lib/format.js";
import { useAnalysis } from "../../../composables/useAnalysis.js";
import { useI18n } from "../../../composables/useI18n.js";
import type { MessageKey } from "../../../lib/i18n/index.js";
import { useTuner } from "../stores/tuner.js";
import { stringStatus, type StringStatus } from "../../../instruments/index.js";
import { sourceStore } from "../../../audio/source.js";

const { t, lang } = useI18n();
const tuner = useTuner();
const { pitch, tick } = useAnalysis();

interface RowState {
  status: StringStatus;
  centsText: string;
}

const STATUS_KEYS: Record<StringStatus, MessageKey> = {
  idle: "tunerStIdle",
  "in-tune": "tunerStInTune",
  flat: "tunerStFlat",
  sharp: "tunerStSharp"
};

/** One row per target; list instruments have exactly one pitch per target. */
const rows = reactive<RowState[]>([]);
const targets = computed(() => tuner.targets.value);

function initRows(): void {
  rows.splice(0, rows.length);
  for (const _ of targets.value) rows.push({ status: "idle", centsText: "" });
}

function syncRows(): void {
  const p = pitch.value;
  const hasSignal = Boolean(p && p.confidence >= 0.35);
  const confidence = p?.confidence ?? 0;

  targets.value.forEach((target, index) => {
    const frequency = midiToFrequency(target.positions[0].midi, analysisSettings.tuning);
    const cents = p ? 1200 * Math.log2(p.frequency / frequency) : 0;
    const status = stringStatus(cents, hasSignal, confidence);
    const text = status === "idle" ? "" : formatCents(cents);
    const row = rows[index];
    if (row && (row.status !== status || row.centsText !== text)) {
      row.status = status;
      row.centsText = text;
    }
  });
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

watch(
  targets,
  () => {
    initRows();
    syncRows();
  },
  { immediate: true }
);

// Change-only sync: only rows whose status or cents actually changed
// re-render (a 21-string guzheng panel stays cheap at ~12 Hz).
watch(tick, syncRows);
</script>

<template>
  <div class="strings-panel" role="list" :aria-label="t('tunerSelectTuning')">
    <div
      v-for="(target, index) in targets"
      :key="target.id"
      class="string-row"
      role="button"
      :tabindex="0"
      :class="[
        `st-${rows[index]?.status ?? 'idle'}`,
        {
          'is-selected': tuner.selection.value?.targetIndex === index,
          'is-auto': tuner.autoMode.value && tuner.autoMatch.value?.targetIndex === index
        }
      ]"
      @click="tuner.selectTarget(index)"
      @keydown.enter.prevent="tuner.selectTarget(index)"
      @keydown.space.prevent="tuner.selectTarget(index)"
    >
      <div class="string-top">
        <span class="string-label">{{ target.label[lang] }}</span>
        <span class="string-note">{{ noteName(target.positions[0].midi) }}</span>
      </div>
      <div class="string-bottom">
        <span class="string-cents">{{ rows[index]?.centsText ?? "" }}</span>
        <span class="string-status">{{ t(STATUS_KEYS[rows[index]?.status ?? "idle"]) }}</span>
      </div>
    </div>
  </div>
</template>
