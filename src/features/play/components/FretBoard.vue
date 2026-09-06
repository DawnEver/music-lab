<script setup lang="ts">
/**
 * The fretboard.
 *
 * Rows are strings, columns are frets, and the note is arithmetic — so
 * this component draws a grid and nothing else. The open string gets its
 * own column because it is played, not fretted, and it is where the
 * string's own label belongs.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { MARKER_FRETS, OCTAVE_FRETS, fretRows } from "../domain/fretboard.js";
import type { TuningPreset } from "../../../instruments/index.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";

const props = defineProps<{
  preset: TuningPreset;
  frets: number;
  sounding: Set<number>;
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
}>();

const { lang } = useI18n();

const rows = computed(() => fretRows(props.preset, props.frets, lang.value));
const fretNumbers = computed(() => Array.from({ length: props.frets + 1 }, (_, fret) => fret));

function inlay(fret: number): string {
  if (OCTAVE_FRETS.includes(fret)) return "double";
  return MARKER_FRETS.includes(fret) ? "single" : "";
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function onEnter(event: PointerEvent, midi: number): void {
  if (event.buttons !== 0) emit("down", midi);
}
</script>

<template>
  <div class="fret-board" :style="{ '--fret-count': frets + 1 }">
    <div class="fret-row fret-numbers">
      <span class="fret-label" />
      <span v-for="fret in fretNumbers" :key="fret" class="fret-number" :data-inlay="inlay(fret)">
        {{ fret === 0 ? "" : fret }}
      </span>
    </div>

    <div v-for="row in rows" :key="row.openMidi + '-' + row.label" class="fret-row">
      <span class="fret-label">{{ row.label }}</span>
      <button
        v-for="(midi, fret) in row.notes"
        :key="fret"
        type="button"
        class="fret-cell"
        :class="{ 'is-open': fret === 0, 'is-down': sounding.has(midi) }"
        :aria-label="noteName(midi)"
        :aria-pressed="sounding.has(midi)"
        @pointerdown.prevent="emit('down', midi)"
        @pointerenter="onEnter($event, midi)"
        @pointerup="emit('up', midi)"
        @pointerleave="emit('up', midi)"
        @pointercancel="emit('up', midi)"
      >
        <span class="fret-dot" />
      </button>
    </div>
  </div>
</template>
