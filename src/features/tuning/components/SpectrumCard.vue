<script setup lang="ts">
import { computed } from "vue";
import { sourceStore } from "../../../audio/source.js";
import { useI18n } from "../../../composables/useI18n.js";
import CollapsibleCard from "../../../shared/components/CollapsibleCard.vue";
import SpectrumCanvas from "./SpectrumCanvas.vue";
import LevelMeter from "./LevelMeter.vue";

const { t } = useI18n();

const sampleRateText = computed(() =>
  sourceStore.sampleRate ? `${(sourceStore.sampleRate / 1000).toFixed(1)} kHz` : "— kHz"
);
</script>

<template>
  <CollapsibleCard
    panel-id="spectrum"
    :title="t('spectrumTitle')"
    panel-class="card--wide"
  >
    <template #badge>
      <div class="spectrum-meta" aria-hidden="true">
        <span>FFT 16384</span>
        <span>{{ sampleRateText }}</span>
        <span>{{ t("logScale") }}</span>
      </div>
    </template>

    <SpectrumCanvas />

    <div v-if="sourceStore.mode === 'idle'" class="spectrum-empty" data-spectrum-empty>
      {{ t("spectrumEmpty") }}
    </div>

    <LevelMeter />
  </CollapsibleCard>
</template>
