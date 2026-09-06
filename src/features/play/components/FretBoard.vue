<script setup lang="ts">
/**
 * The fretboard, in either orientation.
 *
 * Rows and columns are built as one generic grid and the orientation only
 * decides which axis is which — a transposed matrix, not a second
 * component. Horizontal reads like tablature (first string on top);
 * vertical reads like the neck pointing away from you (sixth string on
 * the left), which is the only shape that survives a phone.
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
  orientation: "horizontal" | "vertical";
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
}>();

const { lang } = useI18n();

const strings = computed(() => fretRows(props.preset, props.frets, lang.value));
const fretNumbers = computed(() => Array.from({ length: props.frets + 1 }, (_, fret) => fret));

interface Cell {
  midi: number;
  /** Which fret this cell is at — the nut and the inlays are fret facts. */
  fret: number;
}

interface Line {
  /** Row heading: a string number, or a fret number. */
  label: string;
  /** Marked when the heading is a fret that carries an inlay. */
  fret: number | null;
  cells: Cell[];
}

/** Column headings, and one line per row, for the current orientation. */
const grid = computed<{ headings: { label: string; fret: number | null }[]; lines: Line[] }>(() => {
  if (props.orientation === "horizontal") {
    return {
      headings: fretNumbers.value.map((fret) => ({ label: fret === 0 ? "" : String(fret), fret })),
      lines: strings.value.map((row) => ({
        label: row.label,
        fret: null,
        cells: row.notes.map((midi, fret) => ({ midi, fret }))
      }))
    };
  }
  // Vertical: the neck points away, so the lowest string sits on the left.
  const columns = [...strings.value].reverse();
  return {
    headings: columns.map((row) => ({ label: row.label, fret: null })),
    lines: fretNumbers.value.map((fret) => ({
      label: fret === 0 ? "" : String(fret),
      fret,
      cells: columns.map((row) => ({ midi: row.notes[fret], fret }))
    }))
  };
});

function inlay(fret: number | null): string {
  if (fret === null) return "";
  if (OCTAVE_FRETS.includes(fret)) return "double";
  return MARKER_FRETS.includes(fret) ? "single" : "";
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The letter alone; the octave is in the label a screen reader gets. */
function noteLetter(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

function onEnter(event: PointerEvent, midi: number): void {
  if (event.buttons !== 0) emit("down", midi);
}
</script>

<template>
  <div
    class="fret-board"
    :class="`is-${orientation}`"
    :style="{ '--cols': grid.headings.length }"
  >
    <div class="fret-row fret-headings">
      <span class="fret-label" />
      <span
        v-for="(heading, index) in grid.headings"
        :key="index"
        class="fret-heading"
        :data-inlay="inlay(heading.fret)"
      >
        {{ heading.label }}
      </span>
    </div>

    <div v-for="(line, index) in grid.lines" :key="index" class="fret-row">
      <span class="fret-label" :data-inlay="inlay(line.fret)">{{ line.label }}</span>
      <button
        v-for="cell in line.cells"
        :key="cell.midi"
        type="button"
        class="fret-cell"
        :class="{
          'is-open': cell.fret === 0,
          'is-marked': inlay(cell.fret) !== '',
          'is-down': sounding.has(cell.midi)
        }"
        :aria-label="noteName(cell.midi)"
        :aria-pressed="sounding.has(cell.midi)"
        @pointerdown.prevent="emit('down', cell.midi)"
        @pointerenter="onEnter($event, cell.midi)"
        @pointerup="emit('up', cell.midi)"
        @pointerleave="emit('up', cell.midi)"
        @pointercancel="emit('up', cell.midi)"
      >
        <span class="fret-note">{{ noteLetter(cell.midi) }}</span>
      </button>
    </div>
  </div>
</template>
