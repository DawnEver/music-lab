<script setup lang="ts">
/**
 * The keyboard itself.
 *
 * Geometry comes from `domain/layout.ts` in white-key widths, so the only
 * thing this component decides is how wide a white key is. Black keys are
 * positioned, not flowed — they straddle a boundary rather than occupying
 * a slot, which is exactly why a piano cannot be a flex row.
 *
 * A pointer dragged across the keys glissandos, so a key reacts to
 * entering under a held pointer, not only to being pressed on.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { MAX_WHITE_MM, MIN_WHITE_MM, keyboardLayout, whiteRunMm } from "../domain/layout.js";
import { keysForMidi } from "../domain/keymap.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import type { Orientation } from "../stores/play.js";

const props = defineProps<{
  lowMidi: number;
  highMidi: number;
  baseMidi: number;
  sounding: Set<number>;
  orientation: Orientation;
  /** A white key's width in millimetres, or null to let the room decide. */
  whiteMm: number | null;
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
  /**
   * The width the room arrived at, in millimetres. Only ever sent while
   * the room is deciding — a number the player set is not a measurement.
   */
  (event: "measured", mm: number): void;
}>();

const layout = computed(() => keyboardLayout(props.lowMidi, props.highMidi));
/** One white key, as a fraction of the run the keys occupy. */
const unit = computed(() => 100 / layout.value.whiteCount);

/** CSS millimetres are 96/25.4 pixels, exactly, whatever the screen is. */
const PX_PER_MM = 96 / 25.4;

/**
 * The board, and the width it ended up being drawn at.
 *
 * The sheet that holds the width control covers the keyboard, so the
 * readout beside the slider is the whole feedback loop: with `自适应` on
 * it has to say what auto actually chose, and the slider has to sit there
 * — otherwise the first drag jumps to a width nobody asked for. Measured
 * from the board rather than computed from the window, because the board
 * is the thing that knows: it is the clamp, not the viewport, that decides
 * once the room is wider than a real key.
 */
const board = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;

/** The player's width, or null. An absent one is the room's, not 9mm. */
const chosen = computed(() => props.whiteMm ?? null);

function measure(): void {
  const element = board.value;
  if (!element || chosen.value !== null) return;
  const box = element.getBoundingClientRect();
  const run = props.orientation === "vertical" ? box.height : box.width;
  if (!(run > 0) || !layout.value.whiteCount) return;
  emit("measured", (run / layout.value.whiteCount) / PX_PER_MM);
}

onMounted(() => {
  if (typeof ResizeObserver === "undefined") return;
  observer = new ResizeObserver(measure);
  if (board.value) observer.observe(board.value);
  measure();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

/**
 * The run, in millimetres, when the player has said how wide a key is.
 * Absent rather than empty when they have not: Vue drops an `undefined`
 * style entry, so the stylesheet's own fallback is what applies.
 */
const chosenRun = computed(() =>
  chosen.value === null ? undefined : `${whiteRunMm(layout.value.whiteCount, chosen.value)}mm`
);

/** Black keys are 60% of a white key, centred on the boundary they cross. */
const BLACK_WIDTH = 0.6;

/**
 * The same geometry on either axis. Across, a key's extent is `left` and
 * `width`; down, it is `top` and `height`. Nothing else about the board
 * changes, which is why this is a style object and not a second board.
 */
function place(offset: number, black: boolean): Record<string, string> {
  const start = `${(offset + (black ? 0.5 - BLACK_WIDTH / 2 : 0)) * unit.value}%`;
  const size = `${(black ? BLACK_WIDTH : 1) * unit.value}%`;
  return props.orientation === "vertical"
    ? { top: start, height: size }
    : { left: start, width: size };
}

/** Only C is labelled: any more and the keys become a table of text. */
function label(midi: number): string {
  return midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : "";
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The letter engraved on the physical key, when there is one. */
function keyCap(midi: number): string {
  const code = keysForMidi(midi, props.baseMidi)[0];
  if (!code) return "";
  return code.replace(/^(Key|Digit)/, "").replace("Comma", ",").replace("Period", ".")
    .replace("Slash", "/").replace("Semicolon", ";").replace("BracketLeft", "[")
    .replace("BracketRight", "]").replace("Equal", "=");
}

function onDown(event: PointerEvent, midi: number): void {
  emit("down", midi);
  // Touch captures the pointer to the key it started on, which would kill
  // a glissando. Only release a capture that actually exists.
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
}

function onEnter(event: PointerEvent, midi: number): void {
  // buttons is a bitmask of what is held; 0 means the pointer is just
  // passing over, which must not sound anything.
  if (event.buttons !== 0) emit("down", midi);
}
</script>

<template>
  <!-- The scroll viewport; the board inside it is the keyboard's own size. -->
  <div class="kbd-keys">
    <div
      ref="board"
      class="kbd-board"
      :class="`is-${orientation}`"
      :style="{
        '--kbd-white': layout.whiteCount,
        '--kbd-min': `${MIN_WHITE_MM}mm`,
        '--kbd-max': `${MAX_WHITE_MM}mm`,
        '--kbd-fit': chosenRun
      }"
    >
      <button
        v-for="key in layout.keys"
        :key="key.midi"
        type="button"
        class="kbd-key"
        :class="{ 'is-black': key.black, 'is-down': sounding.has(key.midi) }"
        :style="place(key.offset, key.black)"
        :aria-label="noteName(key.midi)"
        :aria-pressed="sounding.has(key.midi)"
        @pointerdown.prevent="onDown($event, key.midi)"
        @pointerenter="onEnter($event, key.midi)"
        @pointerup="emit('up', key.midi)"
        @pointerleave="emit('up', key.midi)"
        @pointercancel="emit('up', key.midi)"
      >
        <span v-if="keyCap(key.midi)" class="kbd-cap">{{ keyCap(key.midi) }}</span>
        <span v-if="label(key.midi)" class="kbd-note">{{ label(key.midi) }}</span>
      </button>
    </div>
  </div>
</template>
