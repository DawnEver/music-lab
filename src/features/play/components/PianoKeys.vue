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
import { computed } from "vue";
import { keyboardLayout } from "../domain/layout.js";
import { keysForMidi } from "../domain/keymap.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";

const props = defineProps<{
  lowMidi: number;
  highMidi: number;
  baseMidi: number;
  sounding: Set<number>;
}>();

const emit = defineEmits<{
  (event: "down", midi: number): void;
  (event: "up", midi: number): void;
}>();

const layout = computed(() => keyboardLayout(props.lowMidi, props.highMidi));
/** One white key, as a fraction of the whole width. */
const unit = computed(() => 100 / layout.value.whiteCount);

/** Black keys are 60% of a white key, centred on the boundary they cross. */
const BLACK_WIDTH = 0.6;

function leftOf(offset: number, black: boolean): string {
  return `${(offset + (black ? 0.5 - BLACK_WIDTH / 2 : 0)) * unit.value}%`;
}

function widthOf(black: boolean): string {
  return `${(black ? BLACK_WIDTH : 1) * unit.value}%`;
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
    <div class="kbd-board" :style="{ '--kbd-white': layout.whiteCount }">
      <button
        v-for="key in layout.keys"
        :key="key.midi"
        type="button"
        class="kbd-key"
        :class="{ 'is-black': key.black, 'is-down': sounding.has(key.midi) }"
        :style="{ left: leftOf(key.offset, key.black), width: widthOf(key.black) }"
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
