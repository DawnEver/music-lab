<script setup lang="ts">
/** Play/stop, tap tempo, and the running bar counter. */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { metronome, toggle, tap, barCounter } from "../stores/metronome.js";

const { t } = useI18n();
const label = computed(() => (metronome.running ? t("metroStop") : t("metroStart")));
</script>

<template>
  <div class="metro-transport">
    <button
      type="button"
      class="metro-play"
      :class="{ 'is-running': metronome.running }"
      :aria-pressed="metronome.running"
      @click="toggle()"
    >
      <span class="metro-play-icon" aria-hidden="true">{{ metronome.running ? "■" : "▶" }}</span>
      <span>{{ label }}</span>
    </button>

    <button type="button" class="metro-tap" @click="tap()">
      {{ t("metroTap") }}
    </button>

    <div class="metro-readout">
      <output class="metro-bpm-value">{{ metronome.effectiveBpm }}</output>
      <span class="metro-bpm-unit">BPM</span>
      <span class="metro-bar-count">{{ t("metroBars", { count: barCounter + 1 }) }}</span>
    </div>
  </div>
</template>
