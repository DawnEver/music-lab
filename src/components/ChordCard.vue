<script setup lang="ts">
import { computed } from "vue";
import { useAnalysis } from "../composables/useAnalysis.js";
import { useI18n } from "../composables/useI18n.js";
import { NOTE_NAMES } from "../lib/music-theory.js";
import ChromaBars from "./ChromaBars.vue";

const { chord } = useAnalysis();
const { t } = useI18n();

const chordDescription = computed(() =>
  chord.value
    ? `${t(`chordType.${chord.value.descriptionKey}`)} · ${chord.value.tones
        .map((pitchClass) => NOTE_NAMES[pitchClass])
        .join(" · ")}`
    : t("chordDescriptionWaiting")
);

const chordConfidence = computed(() =>
  chord.value
    ? `${Math.round(chord.value.confidence * 100)}% ${t("match")}`
    : t("chordConfidence0")
);
</script>

<template>
  <section class="card metric-card chord" aria-labelledby="chordTitle">
    <div class="card-head">
      <div>
        <p class="section-label">{{ t("chordSectionLabel") }}</p>
        <h2 class="section-title" id="chordTitle">{{ t("chordTitle") }}</h2>
      </div>
      <div class="micro-badge">{{ chordConfidence }}</div>
    </div>

    <div class="chord-main">
      <div class="chord-title-row">
        <div class="chord-name" aria-live="polite">{{ chord ? chord.symbol : "…" }}</div>
        <div class="chord-description">{{ chordDescription }}</div>
      </div>
      <ChromaBars />
    </div>
  </section>
</template>
