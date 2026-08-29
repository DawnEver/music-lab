<script setup lang="ts">
import { computed } from "vue";
import { clamp } from "../../../lib/dsp.js";
import { useI18n } from "../../../composables/useI18n.js";
import TunerNeedle from "./TunerNeedle.vue";

/**
 * The shared cents-deviation gauge: label + signed value + needle.
 * Used by the pitch card and the tuner's big needle readout.
 * The text shows the raw cents; the needle clamps to ±50.
 */
const props = defineProps<{ cents: number }>();

const { t } = useI18n();

const centsText = computed(() => {
  const rounded = Math.round(props.cents);
  const prefix = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)} cent`;
});

const needleCents = computed(() => clamp(props.cents, -50, 50));
</script>

<template>
  <div class="tuner-wrap">
    <div class="tuner-readout">
      <span class="stat-name">{{ t("cents") }}</span>
      <span class="cents-value">{{ centsText }}</span>
    </div>
    <TunerNeedle :cents="needleCents" />
  </div>
</template>
