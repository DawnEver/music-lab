<script setup lang="ts">
import { computed } from "vue";
import { useAnalysis } from "../composables/useAnalysis.js";
import { useI18n } from "../composables/useI18n.js";
import { audioStore } from "../stores/audio.js";
import { frequencyToNote } from "../lib/music-theory.js";
import { clamp } from "../lib/dsp.js";
import TunerNeedle from "./TunerNeedle.vue";

const { pitch } = useAnalysis();
const { t } = useI18n();

const note = computed(() =>
  pitch.value ? frequencyToNote(pitch.value.frequency, audioStore.tuning) : null
);

const confidencePercent = computed(() =>
  pitch.value ? Math.round(clamp(pitch.value.confidence, 0, 1) * 100) : 0
);

const cents = computed(() => (note.value ? clamp(note.value.cents, -50, 50) : 0));

const centsText = computed(() => {
  if (!note.value) return "0 cent";
  const rounded = Math.round(note.value.cents);
  const prefix = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)} cent`;
});

const hintKey = computed(() => {
  if (!note.value) return audioStore.mode === "idle" ? "pitchHintIdle" : "pitchHintAwait";
  return Math.abs(note.value.cents) <= 5
    ? "pitchHintStable"
    : note.value.cents < 0
      ? "pitchHintFlat"
      : "pitchHintSharp";
});

const methodKey = computed(() => (pitch.value ? `method.${pitch.value.method}` : "pitchMethodWaiting"));

const frequencyText = computed(() =>
  pitch.value ? `${pitch.value.frequency.toFixed(pitch.value.frequency < 100 ? 2 : 1)} Hz` : "— Hz"
);
</script>

<template>
  <section class="card metric-card pitch" aria-labelledby="pitchTitle">
    <div class="card-head">
      <div>
        <p class="section-label">{{ t("pitchSectionLabel") }}</p>
        <h2 class="section-title" id="pitchTitle">{{ t("pitchTitle") }}</h2>
      </div>
      <div class="micro-badge">{{ t(methodKey) }}</div>
    </div>

    <div class="pitch-main">
      <div class="note-wrap">
        <div class="note-line" aria-live="polite">
          <span class="note-name">{{ note ? note.name : "…" }}</span>
          <span class="note-octave">{{ note ? note.octave : "" }}</span>
        </div>
        <div class="pitch-subline">
          <span class="frequency">{{ frequencyText }}</span>
          <span class="detector-label">{{ t(hintKey) }}</span>
        </div>
      </div>

      <div class="pitch-side">
        <div class="stat-box">
          <div class="stat-top">
            <span class="stat-name">{{ t("confidence") }}</span>
            <span class="stat-value">{{ confidencePercent }}%</span>
          </div>
          <div class="progress" aria-hidden="true">
            <span :style="{ width: `${confidencePercent}%` }"></span>
          </div>
        </div>

        <div class="tuner-wrap">
          <div class="tuner-readout">
            <span class="stat-name">{{ t("cents") }}</span>
            <span class="cents-value">{{ centsText }}</span>
          </div>
          <TunerNeedle :cents="cents" />
        </div>
      </div>
    </div>
  </section>
</template>
