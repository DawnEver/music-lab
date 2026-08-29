<script setup lang="ts">
/**
 * The bar as pulses grouped exactly as the meter says. Clicking a pulse
 * cycles its accent, so this is also the accent editor. The highlight
 * follows the audio clock (activeBeat is written from rAF), never a timer.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { groupStarts, meterPulses } from "../domain/meter.js";
import { metronome, activeBeat, cycleAccentAt } from "../stores/metronome.js";

const { t } = useI18n();

const rows = computed(() => {
  const starts = groupStarts(metronome.meter);
  return metronome.meter.groups.map((size, index) => ({
    key: `${index}-${size}`,
    pulses: Array.from({ length: size }, (_, offset) => starts[index] + offset)
  }));
});

const total = computed(() => meterPulses(metronome.meter));

function isActive(pulse: number): boolean {
  const beat = activeBeat.value;
  return !!beat && beat.voice === "main" && beat.pulse === pulse;
}
</script>

<template>
  <div class="metro-grid-wrap">
    <div class="metro-grid" role="group" :aria-label="t('metroAccentHint')">
      <div v-for="row in rows" :key="row.key" class="metro-group">
        <button
          v-for="pulse in row.pulses"
          :key="pulse"
          type="button"
          class="metro-beat"
          :class="[`is-${metronome.accents[pulse] ?? 'weak'}`, { 'is-active': isActive(pulse) }]"
          :aria-label="`${pulse + 1} ${t(`accent.${metronome.accents[pulse] ?? 'weak'}`)}`"
          @click="cycleAccentAt(pulse)"
        >
          <span class="metro-beat-index">{{ pulse + 1 }}</span>
        </button>
      </div>
    </div>

    <p class="metro-hint metro-grid-hint">
      {{ t("metroPulses", { count: total }) }} · {{ t("metroAccentHint") }}
    </p>
  </div>
</template>
