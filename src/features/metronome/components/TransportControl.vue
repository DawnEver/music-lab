<script setup lang="ts">
/**
 * The one control that runs the whole tool. Tap tempo sits beside it —
 * both are per-session actions rather than settings — and the play button
 * stays centred on the stage axis.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { metronome, toggle, tap, barCounter } from "../stores/metronome.js";

const { t } = useI18n();
const label = computed(() => (metronome.running ? t("metroStop") : t("metroStart")));
</script>

<template>
  <div class="metro-transport">
    <button type="button" class="metro-tap" @click="tap()">{{ t("metroTap") }}</button>

    <button
      type="button"
      class="metro-play"
      :class="{ 'is-running': metronome.running }"
      :aria-pressed="metronome.running"
      :aria-label="label"
      @click="toggle()"
    >
      <span class="metro-play-icon" aria-hidden="true">{{ metronome.running ? "■" : "▶" }}</span>
    </button>

    <span class="metro-transport-spacer" aria-hidden="true" />

    <span class="metro-bar-count" :class="{ 'is-live': metronome.running }">
      {{ metronome.running ? t("metroBars", { count: barCounter + 1 }) : t("metroSpaceHint") }}
    </span>
  </div>
</template>
