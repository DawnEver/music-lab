<script setup lang="ts">
/**
 * Play a note.
 *
 * One tool, one focus: the instrument's own surface, which never scrolls
 * and never shares the room with anything else. It is not a card — a card
 * insets its content by a padding and rounds its corners, and both of
 * those are taken straight out of the instrument. The stage is the page
 * between the nav and the footer, and the instrument fills it in both
 * directions.
 *
 * The instrument decides what is drawn and what is heard, so there is no
 * timbre control to contradict its name. What is set up before playing —
 * which instrument, which way it runs, which octave the computer keyboard
 * sits at — lives in the bar above the stage, where a control is still in
 * the loop rather than behind a menu.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import PianoKeys from "./components/PianoKeys.vue";
import FretBoard from "./components/FretBoard.vue";
import DrumPads from "./components/DrumPads.vue";
import HoleChart from "./components/HoleChart.vue";
import NoteCells from "./components/NoteCells.vue";
import PlayControl from "./components/PlayControl.vue";
import { keymapSpan, midiForKey } from "./domain/keymap.js";
import { ringStep } from "./domain/radio.js";
import { isTuned } from "../../instruments/index.js";
import {
  allNotesOff,
  hydratePlay,
  instrument,
  orientation,
  noteOff,
  noteOn,
  preset,
  releasePlay,
  setOrientation,
  setVoiceTier,
  settings,
  shiftOctave,
  strike,
  struck,
  sounding,
  VOICE_TIERS,
  type Orientation
} from "./stores/play.js";

const { t, lang } = useI18n();

const span = keymapSpan();
const lowMidi = computed(() => settings.baseMidi + span.low);
const highMidi = computed(() => settings.baseMidi + span.high);

const surface = computed(() => instrument.value.surface);
const isKeys = computed(() => surface.value.kind === "keys");

/**
 * The width the keyboard arrived at on its own, in millimetres.
 *
 * The control that sets it lives in a sheet over the instrument, so this
 * number is the only feedback a player gets while dragging: it is what the
 * slider sits at while the room is still deciding, and it is why the
 * control is not simply a slider over a fixed range.
 */
const autoWidthMm = ref<number | null>(null);
function onMeasured(mm: number): void {
  autoWidthMm.value = mm;
}
const pieces = computed(() => (surface.value.kind === "pads" ? surface.value.pieces : []));
const wind = computed(() =>
  surface.value.kind === "holes" && isTuned(instrument.value) ? instrument.value.tuning.wind : null
);
/** Semitones up from the open string: frets on one, stops on the other. */
const frets = computed(() => {
  const surface = instrument.value.surface;
  if (surface.kind === "frets") return surface.frets;
  if (surface.kind === "stopped") return surface.stops;
  return 0;
});

/** A stopped string has no frets, so the board draws none of their marks. */
const fretted = computed(() => instrument.value.surface.kind === "frets");

/** A row of tines, or holes you blow and draw. */
const cellSurface = computed(() => {
  const kind = surface.value.kind;
  return kind === "tines" || kind === "reeds" ? kind : null;
});

const holes = computed(() =>
  surface.value.kind === "reeds" && isTuned(instrument.value)
    ? instrument.value.tuning.wind?.holeCount ??
      instrument.value.tuning.reeds?.holeCount ??
      10
    : 10
);

/** Every surface turns; the two options are the same two for all of them. */
const ORIENTATIONS: Array<{ id: Orientation; key: "playHorizontal" | "playVertical" }> = [
  { id: "horizontal", key: "playHorizontal" },
  { id: "vertical", key: "playVertical" }
];

/**
 * A one-of-two choice, so that is what it says it is.
 *
 * `aria-pressed` on two adjacent buttons describes two switches that
 * happen to be near each other, and a screen reader reads it that way.
 * Radios say "exactly one of these", which is the truth — and the arrow
 * keys are how a radio group is meant to be moved through.
 */
function onOrientKey(event: KeyboardEvent, index: number): void {
  const next = ringStep(event.key, index, ORIENTATIONS.length);
  if (next === null) return;
  event.preventDefault();
  setOrientation(ORIENTATIONS[next].id);
}

/** The same, for the three ways of sounding the instrument. */
function onTierKey(event: KeyboardEvent, index: number): void {
  const next = ringStep(event.key, index, VOICE_TIERS.length);
  if (next === null) return;
  event.preventDefault();
  setVoiceTier(VOICE_TIERS[next]);
}

/**
 * A phone has no Z–M row to play, and its keyboard scrolls instead. The
 * advice differs, so the copy has to.
 */
const narrow = ref(false);
let media: MediaQueryList | null = null;

function onMedia(event: MediaQueryListEvent | MediaQueryList): void {
  narrow.value = event.matches;
}

const hint = computed(() => {
  if (isKeys.value) return narrow.value ? t("playKeysHintTouch") : t("playKeysHint");
  if (pieces.value.length) return t("playPadsHint");
  if (wind.value) return t("playHolesHint");
  if (cellSurface.value === "tines") return t("playTinesHint");
  if (cellSurface.value === "reeds") return t("playReedsHint");
  return fretted.value ? t("playFretsHint") : t("playStopsHint");
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
  // A chip that has already claimed this arrow has moved its own group,
  // and this listener is on the window, so it would move the octave too:
  // a focused chip and a shift of both octaves is one arrow doing two
  // things. Anything that has been handled is not this handler's.
  if (event.defaultPrevented) return;

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
  hydratePlay(window.innerWidth);
  media = window.matchMedia("(max-width: 720px)");
  onMedia(media);
  media.addEventListener("change", onMedia);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onKeyup);
  window.addEventListener("blur", onBlur);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("blur", onBlur);
  media?.removeEventListener("change", onMedia);
  media = null;
  closeAllSheets();
  releasePlay();
});
</script>

<!--
  Two root nodes, and the layout depends on it: `.dashboard:has(.play-stage)`
  makes the stage's row the one that stretches, so the bar has to come
  first and the stage has to be the thing that fills. Adding a third root
  would give the grid a third row and take the room from the instrument.
-->
<template>
  <!-- Above the stage, outside any card: .card clips, and a sheet must not
       be clipped. -->
  <div class="play-bar">
    <ControlSheet name="setup" :label="t('playSetupTitle')" :value="setupValue">
      <PlayControl :auto-width-mm="autoWidthMm" />
    </ControlSheet>

    <div class="seg-chips" role="radiogroup" :aria-label="t('playOrientation')">
      <button
        v-for="(entry, index) in ORIENTATIONS"
        :key="entry.id"
        type="button"
        role="radio"
        class="seg-chip"
        :class="{ 'is-active': orientation === entry.id }"
        :data-orientation="entry.id"
        :aria-checked="orientation === entry.id"
        :tabindex="orientation === entry.id ? 0 : -1"
        @click="setOrientation(entry.id)"
        @keydown="onOrientKey($event, index)"
      >
        {{ t(entry.key) }}
      </button>
    </div>

    <!--
      How the instrument is made, beside the two other things that are
      chosen before playing rather than during it. It is not a voice menu:
      all three play the instrument the picker names, and what changes is
      whether that instrument is a model, a recording, or the recording's
      attack over the model. Choosing a different sound is choosing a
      different instrument.
    -->
    <div class="seg-chips" role="radiogroup" :aria-label="t('playVoice')">
      <button
        v-for="(tier, index) in VOICE_TIERS"
        :key="tier"
        type="button"
        role="radio"
        class="seg-chip"
        :class="{ 'is-active': settings.voiceTier === tier }"
        :data-tier="tier"
        :aria-checked="settings.voiceTier === tier"
        :tabindex="settings.voiceTier === tier ? 0 : -1"
        @click="setVoiceTier(tier)"
        @keydown="onTierKey($event, index)"
      >
        {{ t(`playVoice_${tier}`) }}
      </button>
    </div>

    <div v-if="isKeys" class="kbd-octave">
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('playOctaveDown')"
        @click="shiftOctave(-1)"
      >
        −
      </button>
      <span class="kbd-octave-value">
        <span class="kbd-octave-word">{{ t("playOctave") }}</span> {{ octaveLabel }}
      </span>
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('playOctaveUp')"
        @click="shiftOctave(1)"
      >
        +
      </button>
    </div>

    <p class="play-hint">{{ hint }}</p>
  </div>

  <section class="play-stage" data-tool="play">
    <PianoKeys
      v-if="isKeys"
      :low-midi="lowMidi"
      :high-midi="highMidi"
      :base-midi="settings.baseMidi"
      :sounding="sounding"
      :orientation="orientation"
      :white-mm="settings.whiteMm"
      @measured="onMeasured"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
    <DrumPads
      v-else-if="pieces.length"
      :pieces="pieces"
      :struck="struck"
      :orientation="orientation"
      @hit="strike"
    />
    <HoleChart
      v-else-if="wind && preset"
      :preset="preset"
      :wind="wind"
      :sounding="sounding"
      :orientation="orientation"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
    <NoteCells
      v-else-if="cellSurface && preset"
      :preset="preset"
      :surface="cellSurface"
      :holes="holes"
      :sounding="sounding"
      :orientation="orientation"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
    <FretBoard
      v-else-if="preset"
      :preset="preset"
      :frets="frets"
      :sounding="sounding"
      :orientation="orientation"
      :fretless="!fretted"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />
  </section>
</template>
