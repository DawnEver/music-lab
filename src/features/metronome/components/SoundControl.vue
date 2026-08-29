<script setup lang="ts">
/** Click timbre and output level; both apply to the live transport. */
import { useI18n } from "../../../composables/useI18n.js";
import { SOUND_BANKS } from "../engine/sound-bank.js";
import { metronome, setBank, setVolume } from "../stores/metronome.js";

const { t } = useI18n();
</script>

<template>
  <div class="control-group metro-sound">
    <div class="metro-field">
      <span class="slider-label">{{ t("metroSoundTitle") }}</span>
      <div class="metro-chips">
        <button
          v-for="bank in SOUND_BANKS"
          :key="bank.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metronome.bankId === bank.id }"
          @click="setBank(bank.id)"
        >
          {{ t(`clickSound.${bank.id}`) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("metroVolume") }}</span>
        <output class="slider-output">{{ Math.round(metronome.volume * 100) }}%</output>
      </div>
      <v-slider
        :min="0"
        :max="100"
        :step="1"
        :model-value="Math.round(metronome.volume * 100)"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setVolume(value / 100)"
      />
    </div>
  </div>
</template>
