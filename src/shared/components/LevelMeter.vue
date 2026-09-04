<script setup lang="ts">
import { computed } from "vue";
import { useAnalysis } from "../../composables/useAnalysis.js";
import { useI18n } from "../../composables/useI18n.js";
import { clamp } from "../../lib/dsp.js";

const { level } = useAnalysis();
const { t } = useI18n();

const levelPercent = computed(() => {
  const rmsDb = level.value?.rmsDb;
  if (rmsDb == null) return 0;
  return clamp((rmsDb + 72) / 72, 0, 1) * 100;
});

const levelText = computed(() => {
  const rmsDb = level.value?.rmsDb;
  if (rmsDb == null || !Number.isFinite(rmsDb) || rmsDb < -100) return "−∞ dB";
  return `${Math.round(rmsDb).toString().replace("-", "−")} dB`;
});
</script>

<template>
  <div class="level-row">
    <span class="level-label">{{ t("inputLabel") }}</span>
    <div class="level-meter" aria-hidden="true">
      <span :style="{ width: `${levelPercent}%` }"></span>
    </div>
    <span class="level-db">{{ levelText }}</span>
  </div>
</template>
