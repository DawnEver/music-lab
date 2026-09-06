<script setup lang="ts">
/**
 * Winds: a chart of notes, each drawn with the fingering that produces it.
 *
 * The tuner shows the same chart to tell you whether a note is in tune;
 * here the chart *is* the instrument — pressing a note blows it. Nothing
 * about the fingering data changes between the two, which is why it lives
 * on the instrument and not in either tool.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import type { TuningPreset, WindLayout } from "../../../instruments/index.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";

const props = defineProps<{
  preset: TuningPreset;
  wind: WindLayout;
  sounding: Set<number>;
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
}>();

const { t, lang } = useI18n();

const notes = computed(() =>
  props.preset.notes.map((midi, index) => ({
    midi,
    label: props.preset.noteLabels?.[index]?.[lang.value] ?? "",
    fingering: props.preset.fingerings?.[index]
  }))
);

const backHoles = computed(() => props.wind.backHoles ?? []);

function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
</script>

<template>
  <div class="hole-chart">
    <button
      v-for="note in notes"
      :key="note.midi"
      type="button"
      class="hole-card"
      :class="{ 'is-down': sounding.has(note.midi) }"
      :aria-label="noteName(note.midi)"
      :aria-pressed="sounding.has(note.midi)"
      @pointerdown.prevent="emit('down', note.midi)"
      @pointerup="emit('up', note.midi)"
      @pointerleave="emit('up', note.midi)"
      @pointercancel="emit('up', note.midi)"
    >
      <span class="hole-head">
        <span class="hole-note">{{ noteName(note.midi) }}</span>
        <span class="hole-degree">{{ note.label }}</span>
      </span>

      <span class="hole-holes">
        <span
          v-for="hole in wind.holeCount"
          :key="hole"
          class="hole-dot"
          :class="[
            `is-${note.fingering?.holes[hole - 1] ?? 'open'}`,
            { 'is-back': backHoles.includes(hole) }
          ]"
        />
      </span>

      <span v-if="note.fingering?.keys?.length" class="hole-key">
        {{ note.fingering.keys.map((key) => t(`instrument.windKey.${key}`)).join(" · ") }}
      </span>
    </button>
  </div>
</template>
