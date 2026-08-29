<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useAnalysis } from "../../../composables/useAnalysis.js";
import { clearSpectrumCanvas } from "../../../lib/draw.js";

const { spectrumTargets } = useAnalysis();

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  if (wrap.value && canvas.value) {
    spectrumTargets.add({ canvas: canvas.value, wrap: wrap.value });
    clearSpectrumCanvas(canvas.value, wrap.value);
  }
});

onBeforeUnmount(() => {
  for (const target of spectrumTargets) {
    if (target.canvas === canvas.value) {
      spectrumTargets.delete(target);
    }
  }
});
</script>

<template>
  <div ref="wrap" class="spectrum-wrap">
    <canvas ref="canvas"></canvas>
  </div>
</template>
