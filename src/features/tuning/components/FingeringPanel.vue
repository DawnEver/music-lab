<script setup lang="ts">
import { analysisSettings } from "../../../audio/analysis.js";
/**
 * Wind instruments: a chart of notes, each drawn with the fingering that
 * produces it. The note is what the tuner measures; the diagram is what
 * the player needs in order to reach it.
 */
import { computed, reactive, watch } from "vue";
import { midiToFrequency, NOTE_NAMES } from "../../../lib/music-theory.js";
import { formatCents } from "../../../lib/format.js";
import { useAnalysis } from "../../../composables/useAnalysis.js";
import { useI18n } from "../../../composables/useI18n.js";
import { useTuner } from "../stores/tuner.js";
import { stringStatus, type StringStatus } from "../../../instruments/index.js";
import { sourceStore } from "../../../audio/source.js";

const { t, lang } = useI18n();
const tuner = useTuner();
const { pitch, tick } = useAnalysis();

interface CardState {
  status: StringStatus;
  centsText: string;
}

const cards = reactive<CardState[]>([]);
const targets = computed(() => tuner.targets.value);
const holeCount = computed(() => tuner.instrument.value?.wind?.holeCount ?? 6);
const backHoles = computed(() => tuner.instrument.value?.wind?.backHoles ?? []);

function initCards(): void {
  cards.splice(0, cards.length);
  for (const _ of targets.value) cards.push({ status: "idle", centsText: "" });
}

function syncCards(): void {
  const p = pitch.value;
  const hasSignal = Boolean(p && p.confidence >= 0.35);
  const confidence = p?.confidence ?? 0;

  targets.value.forEach((target, index) => {
    const frequency = midiToFrequency(target.positions[0].midi, analysisSettings.tuning);
    const cents = p ? 1200 * Math.log2(p.frequency / frequency) : 0;
    const status = stringStatus(cents, hasSignal, confidence);
    const text = status === "idle" ? "" : formatCents(cents);
    const card = cards[index];
    if (card && (card.status !== status || card.centsText !== text)) {
      card.status = status;
      card.centsText = text;
    }
  });
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

watch(
  targets,
  () => {
    initCards();
    syncCards();
  },
  { immediate: true }
);

watch(tick, syncCards);
</script>

<template>
  <div class="fingering-panel" role="list" :aria-label="t('tunerSelectTuning')">
    <div
      v-for="(target, index) in targets"
      :key="target.id"
      class="fingering-card"
      role="button"
      :tabindex="0"
      :class="[
        `st-${cards[index]?.status ?? 'idle'}`,
        {
          'is-selected': tuner.selection.value?.targetIndex === index,
          'is-auto': tuner.autoMode.value && tuner.autoMatch.value?.targetIndex === index
        }
      ]"
      @click="tuner.selectTarget(index)"
      @keydown.enter.prevent="tuner.selectTarget(index)"
      @keydown.space.prevent="tuner.selectTarget(index)"
    >
      <div class="fingering-head">
        <span class="fingering-note">{{ noteName(target.positions[0].midi) }}</span>
        <span class="fingering-degree">{{ target.label[lang] }}</span>
      </div>

      <div class="fingering-holes" :aria-label="t('tunerFingering')">
        <span
          v-for="hole in holeCount"
          :key="hole"
          class="fingering-hole"
          :class="[
            `is-${target.fingering?.holes[hole - 1] ?? 'open'}`,
            { 'is-back': backHoles.includes(hole) }
          ]"
        ></span>
      </div>

      <div class="fingering-foot">
        <span v-if="target.fingering?.keys?.length" class="fingering-key">
          {{ target.fingering.keys.map((key) => t(`tuner.windKey.${key}`)).join(" · ") }}
        </span>
        <span class="fingering-cents">{{ cards[index]?.centsText ?? "" }}</span>
      </div>
    </div>
  </div>
</template>
