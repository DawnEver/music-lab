<script setup lang="ts">
/** BPM slider with fine nudges and the beat unit the BPM counts. */
import { useI18n } from "../../../composables/useI18n.js";
import { MIN_BPM, MAX_BPM } from "../domain/tempo.js";
import { metronome, setBpm, nudgeBpm, setBeatUnit } from "../stores/metronome.js";
import type { Denominator } from "../domain/meter.js";

const { t } = useI18n();
const BEAT_UNITS: Denominator[] = [2, 4, 8, 16];

function onSlider(value: number | null): void {
  if (value != null) setBpm(value);
}
</script>

<template>
  <div class="control-group metro-tempo">
    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("metroBpm") }}</span>
        <output class="slider-output">{{ metronome.bpm }} BPM</output>
      </div>
      <div class="metro-tempo-row">
        <button type="button" class="metro-step" @click="nudgeBpm(-1)" aria-label="-1 BPM">−</button>
        <v-slider
          :min="MIN_BPM"
          :max="MAX_BPM"
          :step="1"
          :model-value="metronome.bpm"
          hide-details
          density="compact"
          @update:model-value="onSlider"
        />
        <button type="button" class="metro-step" @click="nudgeBpm(1)" aria-label="+1 BPM">+</button>
      </div>
      <p class="metro-hint">{{ t("metroTapHint") }}</p>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("metroBeatUnit") }}</span>
      <div class="metro-chips">
        <button
          v-for="unit in BEAT_UNITS"
          :key="unit"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metronome.beatUnit === unit }"
          @click="setBeatUnit(unit)"
        >
          {{ t("metroBeatUnitValue", { value: unit }) }}
        </button>
      </div>
    </div>
  </div>
</template>
