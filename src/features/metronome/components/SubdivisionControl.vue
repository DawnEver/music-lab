<script setup lang="ts">
/** Subdivision, swing amount and the polyrhythm layer. */
import { useI18n } from "../../../composables/useI18n.js";
import { SUBDIVISION_PRESETS, POLYRHYTHM_PRESETS } from "../domain/presets.js";
import { metronome } from "../stores/metronome.js";

const { t } = useI18n();

function onSwing(value: number | null): void {
  if (value != null) metronome.swing = value / 100;
}
</script>

<template>
  <div class="control-group metro-rhythm">
    <div class="metro-field">
      <span class="slider-label">{{ t("metroSubdivision") }}</span>
      <div class="metro-chips">
        <button
          v-for="preset in SUBDIVISION_PRESETS"
          :key="preset.divisions"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metronome.divisions === preset.divisions }"
          @click="metronome.divisions = preset.divisions"
        >
          {{ t(`subdivision.${preset.key}`) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("metroSwing") }}</span>
        <output class="slider-output">
          {{ metronome.swing ? `${Math.round(metronome.swing * 100)}%` : t("metroSwingStraight") }}
        </output>
      </div>
      <v-slider
        :min="0"
        :max="100"
        :step="1"
        :model-value="Math.round(metronome.swing * 100)"
        hide-details
        density="compact"
        @update:model-value="onSwing"
      />
      <p class="metro-hint">{{ t("metroSwingHint") }}</p>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("metroPoly") }}</span>
      <div class="metro-chips">
        <button
          v-for="value in POLYRHYTHM_PRESETS"
          :key="value"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metronome.polyrhythm === value }"
          @click="metronome.polyrhythm = value"
        >
          {{ value === 0 ? t("metroPolyOff") : `${value} : ${metronome.meter.groups.length}` }}
        </button>
      </div>
      <p class="metro-hint">{{ t("metroPolyHint") }}</p>
    </div>
  </div>
</template>
