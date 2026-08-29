<script setup lang="ts">
/**
 * Practice mode: gradual tempo ramp, silent bars, and random dropouts.
 * Every switch here is read by the pure `practiceForBar()` at each bar
 * boundary, so nothing changes mid-bar.
 */
import { useI18n } from "../../../composables/useI18n.js";
import { metronome } from "../stores/metronome.js";

const { t } = useI18n();
const practice = metronome.practice;

function number(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
</script>

<template>
  <div class="control-group metro-practice">
    <div class="metro-field">
      <label class="metro-switch">
        <input type="checkbox" v-model="practice.rampEnabled" />
        <span>{{ t("metroRamp") }}</span>
      </label>
      <div class="metro-number-row" :class="{ 'is-disabled': !practice.rampEnabled }">
        <label class="metro-number">
          <span>{{ t("metroRampEvery") }}</span>
          <input
            type="number"
            min="1"
            max="64"
            :value="practice.rampEveryBars"
            @input="practice.rampEveryBars = number(($event.target as HTMLInputElement).value, 4)"
          />
        </label>
        <label class="metro-number">
          <span>{{ t("metroRampBpm") }}</span>
          <input
            type="number"
            min="-20"
            max="20"
            :value="practice.rampBpm"
            @input="practice.rampBpm = number(($event.target as HTMLInputElement).value, 5)"
          />
        </label>
        <label class="metro-number">
          <span>{{ t("metroRampMax") }}</span>
          <input
            type="number"
            min="20"
            max="400"
            :value="practice.rampMaxBpm"
            @input="practice.rampMaxBpm = number(($event.target as HTMLInputElement).value, 180)"
          />
        </label>
      </div>
    </div>

    <div class="metro-field">
      <label class="metro-switch">
        <input type="checkbox" v-model="practice.silentEnabled" />
        <span>{{ t("metroSilent") }}</span>
      </label>
      <div class="metro-number-row" :class="{ 'is-disabled': !practice.silentEnabled }">
        <label class="metro-number">
          <span>{{ t("metroPlayBars") }}</span>
          <input
            type="number"
            min="1"
            max="32"
            :value="practice.playBars"
            @input="practice.playBars = number(($event.target as HTMLInputElement).value, 4)"
          />
        </label>
        <label class="metro-number">
          <span>{{ t("metroSilentBars") }}</span>
          <input
            type="number"
            min="1"
            max="32"
            :value="practice.silentBars"
            @input="practice.silentBars = number(($event.target as HTMLInputElement).value, 4)"
          />
        </label>
      </div>
    </div>

    <div class="metro-field">
      <label class="metro-switch">
        <input type="checkbox" v-model="practice.randomMuteEnabled" />
        <span>{{ t("metroRandomMute") }}</span>
      </label>
      <div class="slider-field" :class="{ 'is-disabled': !practice.randomMuteEnabled }">
        <div class="slider-head">
          <span class="slider-label">{{ t("metroRandomChance") }}</span>
          <output class="slider-output">{{ Math.round(practice.randomMuteChance * 100) }}%</output>
        </div>
        <v-slider
          :min="0"
          :max="90"
          :step="5"
          :model-value="Math.round(practice.randomMuteChance * 100)"
          hide-details
          density="compact"
          @update:model-value="(value: number) => (practice.randomMuteChance = value / 100)"
        />
      </div>
    </div>

    <p class="metro-hint">{{ t("metroPracticeHint") }}</p>
  </div>
</template>
