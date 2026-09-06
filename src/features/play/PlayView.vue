<script setup lang="ts">
/**
 * Play a note.
 *
 * One tool, one focus: the instrument's own surface, which never scrolls.
 * The instrument decides what is drawn and what is heard, so there is no
 * timbre control to contradict its name — and the octave shift is on
 * screen only where it is part of the loop, which is the keyed surface.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import PianoKeys from "./components/PianoKeys.vue";
import FretBoard from "./components/FretBoard.vue";
import DrumPads from "./components/DrumPads.vue";
import HoleChart from "./components/HoleChart.vue";
import PlayControl from "./components/PlayControl.vue";
import { keymapSpan, midiForKey } from "./domain/keymap.js";
import { isTuned } from "../../instruments/index.js";
import {
  allNotesOff,
  hydratePlay,
  instrument,
  noteOff,
  noteOn,
  preset,
  releasePlay,
  strike,
  struck,
  settings,
  shiftOctave,
  sounding
} from "./stores/play.js";

const { t, lang } = useI18n();

const span = keymapSpan();
const lowMidi = computed(() => settings.baseMidi + span.low);
const highMidi = computed(() => settings.baseMidi + span.high);

const surface = computed(() => instrument.value.surface);
const isKeys = computed(() => surface.value.kind === "keys");
const pieces = computed(() => (surface.value.kind === "pads" ? surface.value.pieces : []));
const wind = computed(() =>
  surface.value.kind === "holes" && isTuned(instrument.value) ? instrument.value.tuning.wind : null
);
const frets = computed(() =>
  instrument.value.surface.kind === "frets" ? instrument.value.surface.frets : 0
);

const hint = computed(() => {
  if (isKeys.value) return t("playKeysHint");
  if (pieces.value.length) return t("playPadsHint");
  return wind.value ? t("playHolesHint") : t("playFretsHint");
});

const octaveLabel = computed(() => `C${Math.floor(settings.baseMidi / 12) - 1}`);
const setupValue = computed(() => {
  const name = instrument.value.name[lang.value];
  return preset.value ? `${name} · ${preset.value.name[lang.value]}` : name;
});

/** Auto-repeat must not retrigger: a held key is one note, not forty. */
function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    if (!isKeys.value) return;
    event.preventDefault();
    shiftOctave(event.code === "ArrowRight" ? 1 : -1);
    return;
  }

  if (pieces.value.length) {
    const piece = pieces.value.find((entry) => entry.code === event.code);
    if (!piece) return;
    event.preventDefault();
    // A strike has no hold: auto-repeat would be a machine-gun roll.
    if (!event.repeat) void strike(piece.id);
    return;
  }

  if (!isKeys.value) return;
  const midi = midiForKey(event.code, settings.baseMidi);
  if (midi === null) return;
  event.preventDefault();
  if (event.repeat) return;
  void noteOn(midi);
}

function onKeyup(event: KeyboardEvent): void {
  if (!isKeys.value) return;
  const midi = midiForKey(event.code, settings.baseMidi);
  if (midi !== null) noteOff(midi);
}

// Losing the window with keys down would hang every held note.
function onBlur(): void {
  allNotesOff();
}

onMounted(() => {
  hydratePlay();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onKeyup);
  window.addEventListener("blur", onBlur);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("blur", onBlur);
  closeAllSheets();
  releasePlay();
});
</script>

<template>
  <section class="card play-stage" data-tool="play">
    <div v-if="isKeys" class="kbd-octave">
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('playOctaveDown')"
        @click="shiftOctave(-1)"
      >
        −
      </button>
      <span class="kbd-octave-value">{{ t("playOctave") }} {{ octaveLabel }}</span>
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('playOctaveUp')"
        @click="shiftOctave(1)"
      >
        +
      </button>
    </div>

    <PianoKeys
      v-if="isKeys"
      :low-midi="lowMidi"
      :high-midi="highMidi"
      :base-midi="settings.baseMidi"
      :sounding="sounding"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
    <DrumPads
      v-else-if="pieces.length"
      :pieces="pieces"
      :struck="struck"
      @hit="strike"
    />
    <HoleChart
      v-else-if="wind && preset"
      :preset="preset"
      :wind="wind"
      :sounding="sounding"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
    <FretBoard
      v-else-if="preset"
      :preset="preset"
      :frets="frets"
      :sounding="sounding"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />

    <p class="kbd-hint">{{ hint }}</p>
  </section>

  <!-- Outside the card: .card clips, and a sheet must not be clipped. -->
  <div class="metro-chip-row">
    <ControlSheet name="setup" :label="t('playSetupTitle')" :value="setupValue">
      <PlayControl />
    </ControlSheet>
  </div>
</template>
