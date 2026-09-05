<script setup lang="ts">
/**
 * The tuning & analysis tool: input source bar plus every analysis panel
 * over one shared audio stream. The source controls live here rather than
 * in the shell — the metronome has no use for a microphone picker.
 */
import { useI18n } from "../../composables/useI18n.js";
import AudioSource from "../../shared/components/AudioSource.vue";
import TunerPanel from "./components/TunerPanel.vue";
import PitchCard from "./components/PitchCard.vue";
import ChordCard from "./components/ChordCard.vue";
import SettingsCard from "./components/SettingsCard.vue";
import { useTuningLifecycle } from "./composables/useTuningLifecycle.js";
import { hydrateTuner } from "./stores/tuner.js";
import { hydrateAnalysisSettings } from "../../audio/analysis.js";

const { t } = useI18n();
// Reading persisted state is an action of the view, not a side effect of
// importing the store.
hydrateTuner();
hydrateAnalysisSettings();
useTuningLifecycle();
</script>

<template>
  <AudioSource data-tool="tune" />

  <TunerPanel />
  <PitchCard />
  <ChordCard />
  <SettingsCard />

  <p class="footnote">
    <strong>{{ t("footnoteLabel") }}：</strong><span>{{ t("footnoteText") }}</span>
  </p>
</template>
