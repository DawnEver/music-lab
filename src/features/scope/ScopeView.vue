<script setup lang="ts">
/**
 * The scope is one stage, not a stack of panels: a wide canvas of what has
 * been heard, with the controls that change it reachable from the value
 * they change. Layers, window and reference are the only things that stay
 * on screen — everything else is behind the chip that displays it.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import SourceBar from "../../shared/components/SourceBar.vue";
import StatusPill from "../../shared/components/StatusPill.vue";
import ScopeCanvas from "./components/ScopeCanvas.vue";
import ScopeSettings from "./components/ScopeSettings.vue";
import ReferencePicker from "./components/ReferencePicker.vue";
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
import { referenceLabel } from "../../lib/plot/scope.js";
import { hydrateScope, persistScope, playback, scope, WINDOW_CHOICES } from "./stores/scope.js";

const { t } = useI18n();

hydrateScope();

const settingsValue = computed(
  () => `${t(`colormap.${scope.colormap}`)} · ${t(`scopeResolution.${scope.resolution}`)}`
);

const referenceValue = computed(() =>
  scope.referenceMidi === null
    ? t("scopeReferenceNone")
    : referenceLabel(scope.referenceMidi, analysisSettings.tuning)
);

/** Measured from the frozen take, or from everything retained. */
const range = computed(() => {
  // Recomputed on freeze/resume and window changes, not per frame: this is
  // a summary, not a live readout.
  void playback.frozenAt;
  void scope.window;
  return vocalRange(historyBuffer.columns(), { tuning: analysisSettings.tuning });
});

function setWindow(seconds: number): void {
  scope.window = seconds;
  persistScope();
}

function toggleLayer(layer: "showSpectrogram" | "showPitch"): void {
  // Never leave the canvas blank: turning off the last layer turns the
  // other one on.
  scope[layer] = !scope[layer];
  if (!scope.showSpectrogram && !scope.showPitch) {
    scope[layer === "showSpectrogram" ? "showPitch" : "showSpectrogram"] = true;
  }
  persistScope();
}

function toggleFreeze(): void {
  playback.frozenAt = playback.frozenAt === null ? audioContext()?.currentTime ?? 0 : null;
}

function clearHistory(): void {
  historyBuffer.clear();
  playback.frozenAt = null;
}

onMounted(() => {
  setHistoryResolution(scope.resolution);
  startHistory();
});

onBeforeUnmount(() => {
  closeAllSheets();
  stopHistory();
  playback.frozenAt = null;
});
</script>

<template>
  <div class="tool-bar" data-tool="scope">
    <SourceBar />
    <StatusPill />
  </div>

  <section class="card scope-stage">
    <ScopeCanvas />
    <p v-if="sourceStore.mode === 'idle'" class="scope-empty" data-scope-empty>
      {{ t("scopeEmpty") }}
    </p>
  </section>

  <div class="metro-chip-row">
    <div class="scope-toggles">
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': scope.showSpectrogram }"
        @click="toggleLayer('showSpectrogram')"
      >
        {{ t("scopeLayerSpectrogram") }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': scope.showPitch }"
        @click="toggleLayer('showPitch')"
      >
        {{ t("scopeLayerPitch") }}
      </button>
      <button
        v-for="seconds in WINDOW_CHOICES"
        :key="seconds"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': scope.window === seconds }"
        @click="setWindow(seconds)"
      >
        {{ t("scopeWindowSeconds", { seconds }) }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': playback.frozenAt !== null }"
        data-scope-freeze
        @click="toggleFreeze"
      >
        {{ playback.frozenAt === null ? t("scopeFreeze") : t("scopeResume") }}
      </button>
      <button type="button" class="metro-chip" @click="clearHistory">{{ t("scopeClear") }}</button>
    </div>

    <ControlSheet name="scopeReference" :label="t('scopeReference')" :value="referenceValue">
      <ReferencePicker />
    </ControlSheet>

    <ControlSheet
      name="scopeSettings"
      :label="t('scopeColormap')"
      :value="settingsValue"
      align="end"
    >
      <ScopeSettings />
    </ControlSheet>
  </div>

  <p class="footnote scope-range" data-scope-range>
    <strong>{{ t("scopeRangeTitle") }}：</strong>
    <span v-if="range">
      {{ t("scopeRangeValue", { low: range.lowest.name, high: range.highest.name, semitones: range.semitones }) }}
    </span>
    <span v-else>{{ t("scopeRangeEmpty") }}</span>
  </p>
</template>
