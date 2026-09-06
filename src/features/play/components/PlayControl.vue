<script setup lang="ts">
/**
 * Setup: which instrument, how it is strung, how loud.
 *
 * Chips rather than a dropdown, for two reasons: every option stays
 * visible, and a menu overlay teleports out of the sheet — so clicking one
 * reads as clicking outside and closes the sheet under the pointer.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import {
  instrumentCategories,
  instrumentsByCategory,
  isTuned,
  playableInstruments
} from "../../../instruments/index.js";
import {
  instrument,
  preset,
  setFretOrientation,
  setInstrument,
  setPreset,
  setVolume,
  settings
} from "../stores/play.js";

const { t, lang } = useI18n();

// Grouped by category: a flat list of every playable instrument stops
// being scannable the moment the fretted ones arrive.
const groups = computed(() =>
  instrumentCategories
    .map((category) => ({
      category,
      title: t(`instrument.category.${category}`),
      items: instrumentsByCategory(category, playableInstruments)
    }))
    .filter((group) => group.items.length > 0)
);

const presets = computed(() => {
  const current = instrument.value;
  return isTuned(current) ? current.tuning.presets : [];
});

const isFretted = computed(() => instrument.value.surface.kind === "frets");

const ORIENTATIONS = [
  { id: "horizontal", key: "playFretHorizontal" },
  { id: "vertical", key: "playFretVertical" }
] as const;
</script>

<template>
  <div class="control-group">
    <div v-for="group in groups" :key="group.category" class="metro-field">
      <span class="slider-label">{{ group.title }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in group.items"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': settings.instrumentId === entry.id }"
          :data-instrument="entry.id"
          @click="setInstrument(entry.id)"
        >
          {{ entry.name[lang] }}
        </button>
      </div>
    </div>

    <div v-if="presets.length > 1" class="metro-field">
      <span class="slider-label">{{ t("playTuning") }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in presets"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': preset?.id === entry.id }"
          :data-preset="entry.id"
          @click="setPreset(entry.id)"
        >
          {{ entry.name[lang] }}
        </button>
      </div>
    </div>

    <div v-if="isFretted" class="metro-field">
      <span class="slider-label">{{ t("playFretOrientation") }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in ORIENTATIONS"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': settings.fretOrientation === entry.id }"
          :data-orientation="entry.id"
          @click="setFretOrientation(entry.id)"
        >
          {{ t(entry.key) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("playVolume") }}</span>
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
