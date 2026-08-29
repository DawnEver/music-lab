<script setup lang="ts">
import { computed } from "vue";
import { useAnalysis } from "../../../composables/useAnalysis.js";
import { audioStore } from "../stores/audio.js";
import { useI18n } from "../../../composables/useI18n.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import { degreeOf, type Key, type ModeKey } from "../../../lib/key.js";
import CollapsibleCard from "../../../shared/components/CollapsibleCard.vue";
import ChromaBars from "./ChromaBars.vue";

const { chord, keyEstimate } = useAnalysis();
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

const tonicSelection = computed({
  get: () => (audioStore.keyMode === "manual" ? String(audioStore.keyTonic) : "auto"),
  set: (value: string) => {
    if (value === "auto") {
      audioStore.keyMode = "auto";
      return;
    }
    audioStore.keyMode = "manual";
    audioStore.keyTonic = Number(value);
  }
});

const scaleSelection = computed({
  get: () => audioStore.keyScale,
  set: (value: ModeKey) => {
    audioStore.keyScale = value;
    audioStore.keyMode = "manual";
  }
});

const tonicOptions = NOTE_NAMES.map((name, tonic) => ({ value: String(tonic), label: name }));

const resolvedKey = computed<Key | null>(() =>
  audioStore.keyMode === "manual"
    ? { tonic: audioStore.keyTonic, mode: audioStore.keyScale }
    : (keyEstimate.value?.key ?? null)
);

const keyName = computed(() =>
  resolvedKey.value
    ? `${NOTE_NAMES[resolvedKey.value.tonic]} ${t(`keyMode.${resolvedKey.value.mode}`)}`
    : ""
);

const degree = computed(() =>
  chord.value && resolvedKey.value
    ? degreeOf(chord.value.root, chord.value.descriptionKey, resolvedKey.value)
    : null
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

      <div class="key-row">
        <div class="key-selects">
          <select
            v-model="tonicSelection"
            class="key-select"
            :aria-label="t('keyLabel')"
          >
            <option value="auto">{{ t("keyAuto") }}</option>
            <option v-for="option in tonicOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <select
            v-model="scaleSelection"
            class="key-select key-select--scale"
            :disabled="audioStore.keyMode !== 'manual'"
            :aria-label="t('keyScaleLabel')"
          >
            <option value="major">{{ t("keyMode.major") }}</option>
            <option value="minor">{{ t("keyMode.minor") }}</option>
          </select>
        </div>

        <div v-if="degree" class="degree-display" aria-live="polite">
          <span class="degree-key">{{ keyName }}</span>
          <span class="degree-numeral">{{ degree.numeral }}</span>
          <span class="degree-badges">
            <span
              class="degree-badge"
              :class="degree.diatonic ? 'is-diatonic' : 'is-chromatic'"
            >
              {{ degree.diatonic ? t("degreeDiatonic") : t("degreeChromatic") }}
            </span>
            <span v-if="degree.variant === 'harmonic'" class="degree-badge">
              {{ t("degreeHarmonicVariant") }}
            </span>
            <span v-if="degree.secondary" class="degree-badge is-secondary">
              {{ t("degreeSecondary", { target: degree.secondary }) }}
            </span>
          </span>
        </div>
        <div v-else class="degree-display degree-empty">{{ t("degreeWaiting") }}</div>
      </div>

      <ChromaBars />
    </div>
  </CollapsibleCard>
</template>
