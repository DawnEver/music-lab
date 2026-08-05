<script setup lang="ts">
import TunerPanel from "../components/tuner/TunerPanel.vue";
import PitchCard from "../components/PitchCard.vue";
import ChordCard from "../components/ChordCard.vue";
import SpectrumCard from "../components/SpectrumCard.vue";
import SettingsCard from "../components/SettingsCard.vue";

/**
 * The workbench: every analysis tool as a collapsible panel over the
 * shared audio stream.
 */
</script>

<template>
  <TunerPanel />
  <PitchCard />
  <ChordCard />
  <SpectrumCard />
  <SettingsCard />
</template>
