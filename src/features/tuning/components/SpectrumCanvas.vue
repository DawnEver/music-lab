<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { onFrame } from "../../../audio/analysis.js";
import { clearSpectrumCanvas, drawSpectrum } from "../../../lib/plot/spectrum.js";

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  if (!wrap.value || !canvas.value) return;
  clearSpectrumCanvas(canvas.value, wrap.value);
  // Drawing subscribes to the stream; it never enters Vue reactivity.
  unsubscribe = onFrame((frame) => {
    if (!wrap.value || !canvas.value) return;
    drawSpectrum(frame.frequencyData, {
      canvas: canvas.value,
      wrap: wrap.value,
      sampleRate: frame.sampleRate,
      fftSize: frame.fftSize,
      latestPitch: frame.pitch,
      tuning: frame.tuning
    });
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
  unsubscribe = null;
});
</script>

<template>
  <div ref="wrap" class="spectrum-wrap">
    <canvas ref="canvas"></canvas>
  </div>
</template>
