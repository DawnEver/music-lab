<script setup lang="ts">
/**
 * The reference line: follow the tuner's current target, or pin a note.
 * A reference is one horizontal line — the same model whether it comes
 * from an instrument target or from the picker.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import { persistScope, scope } from "../stores/scope.js";

const { t } = useI18n();

const OCTAVES = [1, 2, 3, 4, 5, 6];

const pitchClass = computed(() => (scope.referenceMidi ?? 69) % 12);
const octave = computed(() => Math.floor((scope.referenceMidi ?? 69) / 12) - 1);

function set(pc: number, oct: number): void {
  scope.referenceMidi = (oct + 1) * 12 + pc;
  persistScope();
}

function clear(): void {
  scope.referenceMidi = null;
  persistScope();
}
</script>

<template>
  <div class="control-group">
    <div class="metro-field">
      <span class="slider-label">{{ t("scopeReference") }}</span>
      <div class="metro-chips">
        <button
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.referenceMidi === null }"
          @click="clear"
        >
          {{ t("scopeReferenceNone") }}
        </button>
        <button
          v-for="(name, index) in NOTE_NAMES"
          :key="name"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.referenceMidi !== null && pitchClass === index }"
          @click="set(index, octave)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">Octave</span>
      <div class="metro-chips">
        <button
          v-for="value in OCTAVES"
          :key="value"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.referenceMidi !== null && octave === value }"
          @click="set(pitchClass, value)"
        >
          {{ value }}
        </button>
      </div>
    </div>
  </div>
</template>
