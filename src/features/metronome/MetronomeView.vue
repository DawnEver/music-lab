<script setup lang="ts">
/**
 * The metronome tool. Its transport bar stays pinned at the top; every
 * other control is a collapsible card, matching the tuning workbench.
 */
import { onBeforeUnmount } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import CollapsibleCard from "../../shared/components/CollapsibleCard.vue";
import TransportControl from "./components/TransportControl.vue";
import TempoControl from "./components/TempoControl.vue";
import MeterSelector from "./components/MeterSelector.vue";
import BeatGrid from "./components/BeatGrid.vue";
import SubdivisionControl from "./components/SubdivisionControl.vue";
import PracticePanel from "./components/PracticePanel.vue";
import SoundControl from "./components/SoundControl.vue";
import { meterLabel } from "./domain/meter.js";
import { metronome, stop } from "./stores/metronome.js";

const { t } = useI18n();

// Leaving the tool releases the audio lease; nothing keeps clicking in
// the background.
onBeforeUnmount(() => stop());
</script>

<template>
  <section class="card card--wide card--stack metro-hero" data-tool="metronome">
    <div class="card-head">
      <h2 class="section-title">{{ t("metronomeTitle") }}</h2>
      <span class="micro-badge">{{ meterLabel(metronome.meter) }}</span>
    </div>
    <p class="metro-hint">{{ t("metronomeIntro") }}</p>
    <TransportControl />
    <BeatGrid />
  </section>

  <CollapsibleCard panel-id="metroTempo" :title="t('metroTempoTitle')" panel-class="card--wide card--stack">
    <template #badge>
      <span class="micro-badge">{{ metronome.bpm }} BPM</span>
    </template>
    <TempoControl />
  </CollapsibleCard>

  <CollapsibleCard panel-id="metroMeter" :title="t('metroMeterTitle')" panel-class="card--wide card--stack">
    <template #badge>
      <span class="micro-badge">{{ meterLabel(metronome.meter) }}</span>
    </template>
    <MeterSelector />
  </CollapsibleCard>

  <CollapsibleCard panel-id="metroRhythm" :title="t('metroRhythmTitle')" panel-class="card--wide card--stack">
    <SubdivisionControl />
  </CollapsibleCard>

  <CollapsibleCard panel-id="metroPractice" :title="t('metroPracticeTitle')" panel-class="card--wide card--stack">
    <PracticePanel />
  </CollapsibleCard>

  <CollapsibleCard panel-id="metroSound" :title="t('metroSoundTitle')" panel-class="card--wide card--stack">
    <SoundControl />
  </CollapsibleCard>
</template>
