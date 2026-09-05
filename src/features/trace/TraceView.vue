<script setup lang="ts">
/**
 * The trace is one stage: a wide canvas of what has been heard, and the
 * knobs that change it.
 *
 * Unlike the metronome, those knobs belong on screen. A dB floor is set by
 * nudging it while watching the picture, and a popover turns that into a
 * two-step loop. So a wide screen lays them flat under the canvas; a phone
 * has no room for both, and gets the same panel inside a sheet.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import { useAudioInput } from "../../composables/useAudioInput.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import AudioSource from "../../shared/components/AudioSource.vue";
import TraceCanvas from "./components/TraceCanvas.vue";
import SpectrumStrip from "./components/SpectrumStrip.vue";
import TraceControls from "./components/TraceControls.vue";
import { sourceStore } from "../../audio/source.js";
import { analysisSettings } from "../../audio/analysis.js";
import {
  historyBuffer,
  setHistoryResolution,
  startHistory,
  stopHistory
} from "../../audio/history.js";
import { audioContext } from "../../audio/source.js";
import { vocalRange } from "../../lib/pitch-track.js";
import { hydrateTrace, playback, traceView } from "./stores/trace.js";

const { t } = useI18n();

hydrateTrace();

// The trace reads the shared input; the session outlives this view.
useAudioInput();

const settingsValue = computed(
  () => `${t(`colormap.${traceView.colormap}`)} · ${t(`traceResolution.${traceView.resolution}`)}`
);

/** Measured from the frozen take, or from everything retained. */
const range = computed(() => {
  // Recomputed on freeze/resume and window changes, not per frame: this is
  // a summary, not a live readout.
  void playback.frozenAt;
  void traceView.window;
  return vocalRange(historyBuffer.columns(), { tuning: analysisSettings.tuning });
});

/** Hover readout, formatted; empty when the pointer is away. */
const hoverText = computed(() => {
  const hover = playback.hover;
  if (!hover) return "";
  const level = hover.db === null ? "—" : `${Math.round(hover.db)} dB`;
  return `${hover.note} · ${hover.hz.toFixed(1)} Hz · ${level}`;
});

function toggleFreeze(): void {
  playback.frozenAt = playback.frozenAt === null ? audioContext()?.currentTime ?? 0 : null;
}

function clearHistory(): void {
  historyBuffer.clear();
  playback.frozenAt = null;
}

onMounted(() => {
  setHistoryResolution(traceView.resolution);
  startHistory();
});

onBeforeUnmount(() => {
  closeAllSheets();
  stopHistory();
  playback.frozenAt = null;
});
</script>

<template>
  <AudioSource data-tool="trace" />

  <section class="card trace-stage">
    <TraceCanvas />
    <SpectrumStrip v-if="traceView.showSpectrum" />
    <div v-if="sourceStore.mode === 'idle'" class="trace-empty" data-trace-empty>
      <strong>{{ t("traceEmpty") }}</strong>
      <span>{{ t("traceIntro") }}</span>
    </div>
  </section>

  <!-- Actions stay on the stage at every size: freeze and clear are
       things you reach for mid-phrase. -->
  <div class="trace-actions">
    <button
      type="button"
      class="metro-chip"
      :class="{ 'is-active': playback.frozenAt !== null }"
      data-trace-freeze
      @click="toggleFreeze"
    >
      {{ playback.frozenAt === null ? t("traceFreeze") : t("traceResume") }}
    </button>
    <button type="button" class="metro-chip" @click="clearHistory">{{ t("traceClear") }}</button>

    <p class="trace-readout" data-trace-readout>
      <span v-if="playback.frozenAt !== null" class="trace-frozen">{{ t("traceFrozen") }}</span>
      <span>{{ hoverText }}</span>
    </p>

    <p class="trace-readout trace-range" data-trace-range>
      <span v-if="range">
        {{ t("traceRangeValue", { low: range.lowest.name, high: range.highest.name, semitones: range.semitones }) }}
      </span>
    </p>
  </div>

  <!-- Wide screens keep every knob visible; a phone gets the same panel
       inside a sheet, because there is not room for both. -->
  <TraceControls class="trace-controls--flat" />

  <div class="metro-chip-row trace-chip-row">
    <ControlSheet name="traceSettings" :label="t('traceTitle')" :value="settingsValue" align="end">
      <TraceControls />
    </ControlSheet>
  </div>



</template>
