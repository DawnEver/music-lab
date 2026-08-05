<script setup lang="ts">
import { computed } from "vue";
import { audioStore } from "../stores/audio.js";
import { useI18n } from "../composables/useI18n.js";
import SpectrumCanvas from "./SpectrumCanvas.vue";
import LevelMeter from "./LevelMeter.vue";

const { t } = useI18n();

const sampleRateText = computed(() =>
  audioStore.sampleRate ? `${(audioStore.sampleRate / 1000).toFixed(1)} kHz` : "— kHz"
);
</script>

<template>
  <section class="card spectrum-card" aria-labelledby="spectrumTitle">
    <div class="spectrum-head">
      <div>
        <p class="section-label">{{ t("spectrumSectionLabel") }}</p>
        <h2 class="section-title" id="spectrumTitle">{{ t("spectrumTitle") }}</h2>
      </div>
      <div class="spectrum-meta" aria-hidden="true">
        <span>FFT 16384</span>
        <span>{{ sampleRateText }}</span>
        <span>{{ t("logScale") }}</span>
      </div>
    </div>

    <SpectrumCanvas />

    <div v-if="audioStore.mode === 'idle'" class="spectrum-empty" data-spectrum-empty>
      {{ t("spectrumEmpty") }}
    </div>

    <LevelMeter />
  </section>
</template>
