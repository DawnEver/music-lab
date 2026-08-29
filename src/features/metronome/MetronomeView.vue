<script setup lang="ts">
/**
 * The metronome is a single screen, not a stack of panels.
 *
 * Beat grid, tempo and the play button are the only things a player needs
 * while playing, so they never scroll away. Everything else is reached by
 * tapping the value it changes: the 4/4 chip opens the meter editor, the
 * subdivision chip opens the feel editor, and so on. One focus, one page.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import TransportControl from "./components/TransportControl.vue";
import TempoDisplay from "./components/TempoDisplay.vue";
import BeatGrid from "./components/BeatGrid.vue";
import MeterSelector from "./components/MeterSelector.vue";
import SubdivisionControl from "./components/SubdivisionControl.vue";
import PracticePanel from "./components/PracticePanel.vue";
import SoundControl from "./components/SoundControl.vue";
import { meterLabel } from "./domain/meter.js";
import { SUBDIVISION_PRESETS } from "./domain/presets.js";
import { metronome, stop, toggle, nudgeBpm } from "./stores/metronome.js";

const { t } = useI18n();

const feelValue = computed(() => {
  const preset = SUBDIVISION_PRESETS.find((entry) => entry.divisions === metronome.divisions);
  const parts = [preset ? t(`subdivision.${preset.key}`) : String(metronome.divisions)];
  if (metronome.swing > 0) parts.push(`Swing ${Math.round(metronome.swing * 100)}%`);
  if (metronome.polyrhythm > 0) parts.push(`${metronome.polyrhythm}:${metronome.meter.groups.length}`);
  return parts.join(" · ");
});

const soundValue = computed(
  () => `${t(`clickSound.${metronome.bankId}`)} · ${Math.round(metronome.volume * 100)}%`
);

const practiceValue = computed(() => {
  const active = [
    metronome.practice.rampEnabled,
    metronome.practice.silentEnabled,
    metronome.practice.randomMuteEnabled
  ].filter(Boolean).length;
  return active ? t("metroPracticeOn", { count: active }) : t("metroPracticeOff");
});

/** Space starts and stops; the arrows nudge the tempo. */
function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

  if (event.code === "Space") {
    event.preventDefault();
    void toggle();
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    nudgeBpm(event.key === "ArrowUp" ? 1 : -1);
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));

// Leaving the tool releases the audio lease; nothing clicks in the
// background, and no sheet stays open behind the next page.
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  closeAllSheets();
  stop();
});
</script>

<template>
  <section class="card metro-stage" data-tool="metronome">
    <BeatGrid />
    <TempoDisplay />
    <TransportControl />
  </section>

  <!-- The chip row lives outside the card on purpose: .card sets
       backdrop-filter + overflow:hidden, which would clip the popovers and
       make the mobile bottom sheet position against the card, not the
       viewport. -->
  <div class="metro-chip-row">
    <ControlSheet name="meter" :label="t('metroMeterTitle')" :value="meterLabel(metronome.meter)">
      <MeterSelector />
    </ControlSheet>

    <ControlSheet name="feel" :label="t('metroRhythmTitle')" :value="feelValue">
      <SubdivisionControl />
    </ControlSheet>

    <ControlSheet name="sound" :label="t('metroSoundTitle')" :value="soundValue" align="end">
      <SoundControl />
    </ControlSheet>

    <ControlSheet name="practice" :label="t('metroPracticeTitle')" :value="practiceValue" align="end">
      <PracticePanel />
    </ControlSheet>
  </div>
</template>
