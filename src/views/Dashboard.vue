<script setup lang="ts">
import { computed } from "vue";
import TunerPanel from "../components/tuner/TunerPanel.vue";
import PitchCard from "../components/PitchCard.vue";
import ChordCard from "../components/ChordCard.vue";
import SpectrumCard from "../components/SpectrumCard.vue";
import SettingsCard from "../components/SettingsCard.vue";

/**
 * The workbench: all analysis tools as collapsible panels over the shared
 * audio stream. `focus` narrows the view to a single tool (route compat
 * for the legacy #/tuner and #/analyzer links).
 */
const props = defineProps<{
  focus?: "tuner" | "analyzer" | null;
}>();

const showTuner = computed(() => !props.focus || props.focus === "tuner");
const showAnalyzer = computed(() => !props.focus || props.focus === "analyzer");
</script>

<template>
  <TunerPanel v-if="showTuner" :focus="focus === 'tuner'" />
  <template v-if="showAnalyzer">
    <PitchCard :focus="focus === 'analyzer'" />
    <ChordCard :focus="focus === 'analyzer'" />
    <SpectrumCard :focus="focus === 'analyzer'" />
    <SettingsCard :focus="focus === 'analyzer'" />
  </template>
</template>
