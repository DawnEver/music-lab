<script setup lang="ts">
import { computed } from "vue";
import { useAnalysis } from "../composables/useAnalysis.js";
import { useI18n } from "../composables/useI18n.js";
import { NOTE_NAMES } from "../lib/music-theory.js";
import CollapsibleCard from "./CollapsibleCard.vue";
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
  <CollapsibleCard
    panel-id="chord"
    :title="t('chordTitle')"
    panel-class="card--tall card--glow card--glow-teal"
  >
    <template #badge>
      <div class="micro-badge">{{ chordConfidence }}</div>
    </template>

    <div class="chord-main">
      <div class="chord-title-row">
        <div class="chord-name" aria-live="polite">{{ chord ? chord.symbol : "…" }}</div>
        <div class="chord-description">{{ chordDescription }}</div>
      </div>
      <ChromaBars />
    </div>
  </CollapsibleCard>
</template>
