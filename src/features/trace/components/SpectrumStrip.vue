<script setup lang="ts">
/**
 * The instant spectrum, as a strip under the time view.
 *
 * It lives here rather than in the tuner because it answers the same
 * question the rest of this page answers — "what is in this sound" — and
 * because a tuner's job is one number, not a graph. Together the two
 * canvases are the same instant read two ways: across time, and across
 * frequency right now.
 */
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
