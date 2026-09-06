<script setup lang="ts">
/** Timbre and output level; both apply to the next note, not this one. */
import { useI18n } from "../../../composables/useI18n.js";
import { TIMBRES } from "../../../audio/timbre.js";
import { settings, setTimbre, setVolume } from "../stores/keyboard.js";

const { t } = useI18n();
</script>

<template>
  <div class="control-group">
    <div class="metro-field">
      <span class="slider-label">{{ t("kbdSoundTitle") }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in TIMBRES"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': settings.timbreId === entry.id }"
          @click="setTimbre(entry.id)"
        >
          {{ t(`timbre.${entry.id}`) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("kbdVolume") }}</span>
        <output class="slider-output">{{ Math.round(settings.volume * 100) }}%</output>
      </div>
      <v-slider
        :min="0"
        :max="100"
        :step="1"
        :model-value="Math.round(settings.volume * 100)"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setVolume(value / 100)"
      />
    </div>
  </div>
</template>
