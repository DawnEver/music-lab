<script setup lang="ts">
/**
 * The tuning & analysis tool: input source bar plus every analysis panel
 * over one shared audio stream. The source controls live here rather than
 * in the shell — the metronome has no use for a microphone picker.
 */
import { useI18n } from "../../composables/useI18n.js";
import SourceBar from "./components/SourceBar.vue";
import StatusPill from "./components/StatusPill.vue";
import TunerPanel from "./components/TunerPanel.vue";
import PitchCard from "./components/PitchCard.vue";
import ChordCard from "./components/ChordCard.vue";
import SpectrumCard from "./components/SpectrumCard.vue";
import SettingsCard from "./components/SettingsCard.vue";
import { useTuningLifecycle } from "./composables/useTuningLifecycle.js";

const { t } = useI18n();
useTuningLifecycle();
</script>

<template>
  <div class="tool-bar" data-tool="tuning">
    <SourceBar />
    <StatusPill />
  </div>

  <TunerPanel />
  <PitchCard />
  <ChordCard />
  <SpectrumCard />
  <SettingsCard />

  <p class="footnote">
    <strong>{{ t("footnoteLabel") }}：</strong><span>{{ t("footnoteText") }}</span>
  </p>
</template>
