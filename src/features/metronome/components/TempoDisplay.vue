<script setup lang="ts">
/**
 * The tempo readout is the tempo control: the number itself is an input
 * (a number invites typing), ± nudges on either side, and the unit label
 * below opens the fine editor. Nothing else shares the row, so the number
 * stays optically centred under the beat grid.
 */
import { computed, ref } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import ControlSheet from "../../../shared/components/ControlSheet.vue";
import TempoControl from "./TempoControl.vue";
import { MAX_BPM, MIN_BPM } from "../domain/tempo.js";
import { metronome, nudgeBpm, setBpm } from "../stores/metronome.js";

const { t } = useI18n();

const draft = ref("");
const editing = ref(false);

/** While the practice ramp runs, the readout follows what is sounding. */
const shown = computed(() => (editing.value ? draft.value : String(metronome.effectiveBpm)));

function onFocus(event: FocusEvent): void {
  editing.value = true;
  draft.value = String(metronome.bpm);
  (event.target as HTMLInputElement).select();
}

function commit(): void {
  if (!editing.value) return;
  editing.value = false;
  const parsed = Number(draft.value);
  if (Number.isFinite(parsed) && parsed > 0) setBpm(parsed);
}

function cancel(event: KeyboardEvent): void {
  editing.value = false;
  draft.value = String(metronome.bpm);
  (event.target as HTMLInputElement).blur();
}

/** Arrows nudge from inside the field too; the global handler skips inputs. */
function onArrow(delta: number): void {
  if (editing.value) {
    const parsed = Number(draft.value);
    if (Number.isFinite(parsed)) setBpm(parsed + delta);
    draft.value = String(metronome.bpm);
    return;
  }
  nudgeBpm(delta);
}
</script>

<template>
  <div class="metro-tempo-display">
    <button type="button" class="metro-step" aria-label="-1 BPM" @click="nudgeBpm(-1)">−</button>

    <div class="metro-bpm">
      <input
        class="metro-bpm-value"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="3"
        :min="MIN_BPM"
        :max="MAX_BPM"
        :value="shown"
        :aria-label="t('metroBpmInput')"
        :title="t('metroBpmEdit')"
        @focus="onFocus"
        @input="draft = ($event.target as HTMLInputElement).value"
        @blur="commit"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.esc.prevent="cancel"
        @keydown.up.prevent="onArrow(1)"
        @keydown.down.prevent="onArrow(-1)"
      />

      <ControlSheet name="tempo" :label="t('metroTempoTitle')" align="center">
        <template #trigger="{ open, toggle }">
          <button
            type="button"
            class="metro-bpm-unit"
            :class="{ 'is-open': open }"
            :aria-expanded="open"
            aria-haspopup="dialog"
            @click="toggle"
          >
            BPM
            <span class="value-chip-caret" aria-hidden="true">▾</span>
          </button>
        </template>
        <TempoControl />
      </ControlSheet>
    </div>

    <button type="button" class="metro-step" aria-label="+1 BPM" @click="nudgeBpm(1)">+</button>
  </div>
</template>
