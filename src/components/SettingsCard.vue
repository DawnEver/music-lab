<script setup lang="ts">
import { audioStore, updateSettings } from "../stores/audio.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();

function onTuning(value: number | null): void {
  if (value != null) updateSettings(value, audioStore.gateDb, audioStore.stability);
}

function onGate(value: number | null): void {
  if (value != null) updateSettings(audioStore.tuning, value, audioStore.stability);
}

function onStability(value: number | null): void {
  if (value != null) updateSettings(audioStore.tuning, audioStore.gateDb, value / 100);
}
</script>

<template>
  <section class="card control-card" :aria-label="t('settingsAria')">
    <div class="control-group">
      <p class="control-group-title">{{ t("settingsTitle") }}</p>
      <div class="sliders">
        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("tuning") }}</span>
            <output class="slider-output">{{ audioStore.tuning }} Hz</output>
          </div>
          <v-slider
            :min="432"
            :max="446"
            :step="1"
            :model-value="audioStore.tuning"
            hide-details
            density="compact"
            @update:model-value="onTuning"
          />
        </div>

        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("noiseGate") }}</span>
            <output class="slider-output">{{ String(audioStore.gateDb).replace("-", "−") }} dB</output>
          </div>
          <v-slider
            :min="-70"
            :max="-28"
            :step="1"
            :model-value="audioStore.gateDb"
            hide-details
            density="compact"
            @update:model-value="onGate"
          />
        </div>

        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("stability") }}</span>
            <output class="slider-output">{{ Math.round(audioStore.stability * 100) }}%</output>
          </div>
          <v-slider
            :min="20"
            :max="92"
            :step="1"
            :model-value="Math.round(audioStore.stability * 100)"
            hide-details
            density="compact"
            @update:model-value="onStability"
          />
        </div>
      </div>
    </div>
  </section>
</template>
