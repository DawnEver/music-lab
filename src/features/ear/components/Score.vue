<script setup lang="ts">
/**
 * The line, written down.
 *
 * Sight-singing is reading: a pitch graph shows what came out, and what a
 * singer needs first is what to sing. Both notations are drawn from the
 * same pure layout — staff for letters, jianpu for degrees, which is the
 * one that matches what ear training actually teaches.
 *
 * Drawn as SVG rather than with a music font, so it needs no assets and
 * scales with the page.
 */
import { computed } from "vue";
import {
  FLAT_ORDER,
  FLAT_STEPS,
  jianpuLayout,
  SHARP_ORDER,
  SHARP_STEPS,
  staffLayout,
  type Accidental
} from "../../../lib/notation.js";
import type { Melody } from "../domain/melody.js";
import type { NoteGrade } from "../domain/sing-judge.js";

const props = withDefaults(
  defineProps<{
    melody: Melody | null;
    notation?: "staff" | "jianpu";
    /** Per-note verdicts, once a take has been judged. */
    grades?: NoteGrade[];
    /** Index of the note being sung, or null. */
    activeIndex?: number | null;
    /** Semitones between what is written and what is sung. */
    octaveShift?: number;
  }>(),
  { notation: "staff", grades: () => [], activeIndex: null, octaveShift: 0 }
);

/** Geometry: one gap between staff lines is the unit everything derives from. */
const GAP = 13;
const BEAT_WIDTH = 52;
const HEAD_LEFT = 78;
const PAD_TOP = 46;
const PAD_BOTTOM = 34;

const staff = computed(() => (props.melody ? staffLayout(props.melody) : null));
const jianpu = computed(() => (props.melody ? jianpuLayout(props.melody) : null));

const width = computed(() => {
  const layout = staff.value;
  if (!layout) return 320;
  return HEAD_LEFT + (layout.notes.length + 1) * BEAT_WIDTH + layout.bars * 10;
});

const height = computed(() => PAD_TOP + 4 * GAP + PAD_BOTTOM);

/** Step 0 is the bottom line; y grows downward from the top line. */
function yOf(step: number): number {
  return PAD_TOP + (8 - step) * (GAP / 2);
}

function xOf(index: number, bar: number): number {
  return HEAD_LEFT + index * BEAT_WIDTH + bar * 10;
}

function accidentalGlyph(accidental: Accidental | null): string {
  if (accidental === "sharp") return "♯";
  if (accidental === "flat") return "♭";
  if (accidental === "natural") return "♮";
  return "";
}

const keyAccidentals = computed(() => {
  const layout = staff.value;
  if (!layout) return [];
  const { kind, count } = layout.keySignature;
  const order = kind === "sharp" ? SHARP_ORDER : FLAT_ORDER;
  const steps = kind === "sharp" ? SHARP_STEPS : FLAT_STEPS;
  return order.slice(0, count).map((letter, index) => ({
    letter,
    glyph: kind === "sharp" ? "♯" : "♭",
    x: 40 + index * 9,
    y: yOf(steps[index])
  }));
});

/** Bar lines fall between bars, never before the first note. */
const barLines = computed(() => {
  const layout = staff.value ?? jianpu.value;
  if (!layout) return [];
  const lines: number[] = [];
  for (const note of layout.notes) {
    if (note.index > 0 && note.bar !== layout.notes[note.index - 1].bar) {
      lines.push(xOf(note.index, note.bar) - BEAT_WIDTH / 2);
    }
  }
  return lines;
});

/** "1 = D": which pitch the numbers are counted from. */
const jianpuKey = computed(() => {
  const midi = props.melody?.tonicMidi ?? 60;
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  return names[((midi % 12) + 12) % 12];
});

function noteClass(index: number): string {
  const grade = props.grades[index];
  const classes = ["score-note"];
  if (grade) classes.push(`is-${grade}`);
  if (props.activeIndex === index) classes.push("is-active");
  return classes.join(" ");
}
</script>

<template>
  <div class="score" :data-notation="notation" data-score>
    <svg
      v-if="melody"
      :viewBox="`0 0 ${width} ${height}`"
      :style="{ maxWidth: `${width}px` }"
      role="img"
      aria-label="score"
    >
      <template v-if="notation === 'staff' && staff">
        <line
          v-for="line in 5"
          :key="`staff-${line}`"
          class="score-line"
          :x1="12"
          :x2="width - 8"
          :y1="yOf((line - 1) * 2)"
          :y2="yOf((line - 1) * 2)"
        />

        <text class="score-clef" x="14" :y="yOf(2) + GAP * 1.15">𝄞</text>

        <text
          v-for="mark in keyAccidentals"
          :key="`key-${mark.letter}`"
          class="score-accidental"
          :x="mark.x"
          :y="mark.y + 4"
        >
          {{ mark.glyph }}
        </text>

        <text class="score-meter" :x="HEAD_LEFT - 26" :y="yOf(6) + 4">{{ staff.beatsPerBar }}</text>
        <text class="score-meter" :x="HEAD_LEFT - 26" :y="yOf(2) + 4">4</text>

        <!-- Sung an octave down: the notation says so rather than moving. -->
        <text v-if="octaveShift === -12" class="score-octave" x="14" :y="yOf(-4)">8vb</text>

        <line
          v-for="(x, index) in barLines"
          :key="`bar-${index}`"
          class="score-bar"
          :x1="x"
          :x2="x"
          :y1="yOf(8)"
          :y2="yOf(0)"
        />

        <g v-for="note in staff.notes" :key="`note-${note.index}`" :class="noteClass(note.index)">
          <line
            v-for="(ledger, li) in note.ledgerSteps"
            :key="`ledger-${note.index}-${li}`"
            class="score-ledger"
            :x1="xOf(note.index, note.bar) - GAP"
            :x2="xOf(note.index, note.bar) + GAP"
            :y1="yOf(ledger)"
            :y2="yOf(ledger)"
          />
          <text
            v-if="note.accidental"
            class="score-accidental"
            :x="xOf(note.index, note.bar) - 20"
            :y="yOf(note.step) + 4"
          >
            {{ accidentalGlyph(note.accidental) }}
          </text>
          <ellipse
            class="score-head"
            :cx="xOf(note.index, note.bar)"
            :cy="yOf(note.step)"
            :rx="GAP * 0.62"
            :ry="GAP * 0.46"
            :transform="`rotate(-18 ${xOf(note.index, note.bar)} ${yOf(note.step)})`"
          />
          <line
            class="score-stem"
            :x1="xOf(note.index, note.bar) + (note.stem === 'up' ? GAP * 0.6 : -GAP * 0.6)"
            :x2="xOf(note.index, note.bar) + (note.stem === 'up' ? GAP * 0.6 : -GAP * 0.6)"
            :y1="yOf(note.step)"
            :y2="yOf(note.step) + (note.stem === 'up' ? -GAP * 3.2 : GAP * 3.2)"
          />
        </g>
      </template>

      <template v-else-if="jianpu">
        <line
          v-for="(x, index) in barLines"
          :key="`jbar-${index}`"
          class="score-bar"
          :x1="x"
          :x2="x"
          :y1="PAD_TOP - 12"
          :y2="PAD_TOP + 30"
        />

        <text class="score-key" x="16" :y="PAD_TOP + 14">
          1 = {{ jianpuKey }}<tspan v-if="octaveShift === -12"> · 8vb</tspan>
        </text>

        <g v-for="note in jianpu.notes" :key="`jnote-${note.index}`" :class="noteClass(note.index)">
          <text
            class="score-degree"
            :x="xOf(note.index, note.bar)"
            :y="PAD_TOP + 16"
            text-anchor="middle"
          >
            {{ note.accidental === "sharp" ? "♯" : "" }}{{ note.degree }}
          </text>
          <circle
            v-for="dot in Math.abs(note.octaveDots)"
            :key="`dot-${note.index}-${dot}`"
            class="score-dot"
            :cx="xOf(note.index, note.bar)"
            :cy="note.octaveDots > 0 ? PAD_TOP - 6 - (dot - 1) * 6 : PAD_TOP + 26 + (dot - 1) * 6"
            r="2"
          />
        </g>
      </template>
    </svg>
  </div>
</template>
