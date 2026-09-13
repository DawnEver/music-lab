<script setup lang="ts">
/**
 * Instruments whose notes are cells: a row of tines, or holes you blow and
 * draw.
 *
 * Both are a set of pitched things laid out the way the instrument is, so
 * they are one component with two arrangements rather than two components
 * that would drift apart. What differs is the axis, and that is data:
 *
 *  - A kalimba is a row, in the order the tines are mounted. That order is
 *    the instrument — the lowest tine is in the middle and the scale
 *    alternates outward — so it is played in the order it is given.
 *  - A harmonica is a grid: ten holes, and two notes in each, which one
 *    sounding depending on which way the air is going. Breath is an axis
 *    of the instrument, not a property of a cell.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import type { TuningPreset } from "../../../instruments/index.js";
import type { Orientation } from "../stores/play.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";

const props = defineProps<{
  preset: TuningPreset;
  surface: "tines" | "reeds";
  /** How many holes a harmonica has; the preset's notes are two per hole. */
  holes?: number;
  sounding: Set<number>;
  orientation: Orientation;
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
}>();

const { t, lang } = useI18n();

interface Cell {
  midi: number;
  /** The engraved mark: a tine's number, or a hole and which way air goes. */
  mark: string;
  /** Which line it sits on when the instrument is a grid. */
  row: number;
}

/**
 * Every cell, in the order the instrument holds them, with the row it
 * belongs to. A row of tines is one row; a harmonica's two breath rows
 * come from the preset's own halves — ten blow notes, then ten draw ones.
 */
const cells = computed<Cell[]>(() => {
  const notes = props.preset.notes;
  const labels = props.preset.noteLabels;

  if (props.surface === "tines") {
    return notes.map((midi, index) => ({
      midi,
      mark: labels?.[index]?.[lang.value] ?? "",
      row: 0
    }));
  }

  // The preset holds the blow notes first and the draw notes after them.
  // Blow is the upper row, because that is the way you blow.
  const holes = props.holes ?? Math.floor(notes.length / 2);
  const out: Cell[] = [];
  for (let hole = 0; hole < holes; hole += 1) {
    out.push({ midi: notes[hole], mark: String(hole + 1), row: 0 });
  }
  for (let hole = 0; hole < holes; hole += 1) {
    out.push({ midi: notes[holes + hole], mark: String(hole + 1), row: 1 });
  }
  return out;
});

/** The breath each row is played with, named on the row itself. */
const ROW_LABELS = ["playBlow", "playDraw"] as const;

const rows = computed(() => {
  const highest = Math.max(...cells.value.map((cell) => cell.row));
  return Array.from({ length: highest + 1 }, (_, row) => ({
    row,
    label: props.surface === "reeds" ? t(ROW_LABELS[row] ?? "playBlow") : "",
    cells: cells.value.filter((cell) => cell.row === row)
  }));
});

function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function letter(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}
</script>

<template>
  <div
    class="note-cells"
    :class="[`is-${orientation}`, `is-${surface}`]"
    :style="{ '--count': rows[0]?.cells.length ?? 1 }"
  >
    <div v-for="line in rows" :key="line.row" class="cells-row">
      <span v-if="line.label" class="cells-row-label">{{ line.label }}</span>
      <div class="cells-line">
        <button
          v-for="cell in line.cells"
          :key="`${cell.row}-${cell.midi}`"
          type="button"
          class="note-cell"
          :class="{ 'is-down': sounding.has(cell.midi) }"
          :data-note="cell.midi"
          :aria-label="noteName(cell.midi)"
          :aria-pressed="sounding.has(cell.midi)"
          @pointerdown.prevent="emit('down', cell.midi)"
          @pointerup="emit('up', cell.midi)"
          @pointerleave="emit('up', cell.midi)"
          @pointercancel="emit('up', cell.midi)"
        >
          <span class="cell-mark">{{ cell.mark }}</span>
          <span class="cell-note">{{ letter(cell.midi) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
