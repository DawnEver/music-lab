<script setup lang="ts">
/**
 * Play a note.
 *
 * One focus that never scrolls: the keyboard. Everything that is set once
 * and then played — timbre, level — hides behind the value it changes;
 * the octave is on screen because it is part of the loop, not before it.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import ControlSheet, { closeAllSheets } from "../../shared/components/ControlSheet.vue";
import PianoKeys from "./components/PianoKeys.vue";
import TimbreControl from "./components/TimbreControl.vue";
import { keymapSpan, midiForKey } from "./domain/keymap.js";
import {
  allNotesOff,
  hydrateKeyboard,
  noteOff,
  noteOn,
  releaseKeyboard,
  settings,
  shiftOctave,
  sounding
} from "./stores/keyboard.js";

const { t } = useI18n();

const span = keymapSpan();
const lowMidi = computed(() => settings.baseMidi + span.low);
const highMidi = computed(() => settings.baseMidi + span.high);

const octaveLabel = computed(() => `C${Math.floor(settings.baseMidi / 12) - 1}`);
const soundValue = computed(
  () => `${t(`timbre.${settings.timbreId}`)} · ${Math.round(settings.volume * 100)}%`
);

/** Auto-repeat must not retrigger: a held key is one note, not forty. */
function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();
    shiftOctave(event.code === "ArrowRight" ? 1 : -1);
    return;
  }

  const midi = midiForKey(event.code, settings.baseMidi);
  if (midi === null) return;
  event.preventDefault();
  if (event.repeat) return;
  void noteOn(midi);
}

function onKeyup(event: KeyboardEvent): void {
  const midi = midiForKey(event.code, settings.baseMidi);
  if (midi !== null) noteOff(midi);
}

// Losing the window with keys down would hang every held note.
function onBlur(): void {
  allNotesOff();
}

onMounted(() => {
  hydrateKeyboard();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onKeyup);
  window.addEventListener("blur", onBlur);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("blur", onBlur);
  closeAllSheets();
  releaseKeyboard();
});
</script>

<template>
  <section class="card kbd-stage" data-tool="play">
    <div class="kbd-octave">
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('kbdOctaveDown')"
        @click="shiftOctave(-1)"
      >
        −
      </button>
      <span class="kbd-octave-value">{{ t("kbdOctave") }} {{ octaveLabel }}</span>
      <button
        type="button"
        class="kbd-octave-btn"
        :aria-label="t('kbdOctaveUp')"
        @click="shiftOctave(1)"
      >
        +
      </button>
    </div>

    <PianoKeys
      :low-midi="lowMidi"
      :high-midi="highMidi"
      :base-midi="settings.baseMidi"
      :sounding="sounding"
      @down="(midi: number) => noteOn(midi)"
      @up="noteOff"
    />

    <p class="kbd-hint">{{ t("kbdHint") }}</p>
  </section>

  <!-- Outside the card: .card clips, and a sheet must not be clipped. -->
  <div class="metro-chip-row">
    <ControlSheet name="timbre" :label="t('kbdSoundTitle')" :value="soundValue">
      <TimbreControl />
    </ControlSheet>
  </div>
</template>
