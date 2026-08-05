<script setup lang="ts">
import { reactive, watch } from "vue";
import { midiToFrequency, NOTE_NAMES } from "../../lib/music-theory.js";
import { formatCents } from "../../lib/format.js";
import { useAnalysis } from "../../composables/useAnalysis.js";
import { useI18n } from "../../composables/useI18n.js";
import { useTuner } from "../../composables/useTuner.js";
import { stringStatus, type StringStatus } from "../../instruments/index.js";
import { audioStore } from "../../stores/audio.js";

const { t, lang } = useI18n();
const tuner = useTuner();
const { pitch, tick } = useAnalysis();

interface RowState {
  status: StringStatus;
  centsText: string;
}

const STATUS_KEYS: Record<StringStatus, string> = {
  idle: "tunerStIdle",
  "in-tune": "tunerStInTune",
  flat: "tunerStFlat",
  sharp: "tunerStSharp"
};

const rows = reactive<RowState[]>([]);

function initRows(): void {
  rows.splice(0, rows.length);
  for (const _ of tuner.preset.value?.notes ?? []) {
    rows.push({ status: "idle", centsText: "" });
  }
}

function syncRows(): void {
  const notes = tuner.preset.value?.notes;
  if (!notes) return;
  const p = pitch.value;
  const hasSignal = Boolean(p && p.confidence >= 0.35);
  const confidence = p?.confidence ?? 0;

  for (let index = 0; index < notes.length; index += 1) {
    const target = midiToFrequency(notes[index], audioStore.tuning);
    const cents = p ? 1200 * Math.log2(p.frequency / target) : 0;
    const status = stringStatus(cents, hasSignal, confidence);
    const text = status === "idle" ? "" : formatCents(cents);
    const row = rows[index];
    if (row.status !== status || row.centsText !== text) {
      row.status = status;
      row.centsText = text;
    }
  }
}

watch(
  () => tuner.preset.value?.id,
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
      v-for="(midi, index) in tuner.preset.value?.notes ?? []"
      :key="index"
      class="string-row"
      role="button"
      :tabindex="0"
      :class="[
        `st-${rows[index]?.status ?? 'idle'}`,
        {
          'is-selected': tuner.activeString.value === index,
          'is-auto': tuner.autoMode.value && tuner.autoString.value === index
        }
      ]"
      @click="tuner.selectString(index)"
      @keydown.enter.prevent="tuner.selectString(index)"
      @keydown.space.prevent="tuner.selectString(index)"
    >
      <span class="string-label">
        {{ tuner.preset.value?.noteLabels?.[index]?.[lang] ?? String(index + 1) }}
      </span>
      <span class="string-note">{{ NOTE_NAMES[midi % 12] }}{{ Math.floor(midi / 12) - 1 }}</span>
      <span class="string-cents">{{ rows[index]?.centsText ?? "" }}</span>
      <span class="string-status">{{ t(STATUS_KEYS[rows[index]?.status ?? "idle"]) }}</span>
    </div>
  </div>
</template>
