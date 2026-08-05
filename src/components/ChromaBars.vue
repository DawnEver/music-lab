<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { NOTE_NAMES } from "../lib/music-theory.js";
import { clamp } from "../lib/dsp.js";
import { useAnalysis } from "../composables/useAnalysis.js";
import { useI18n } from "../composables/useI18n.js";

const { chroma, chord, tick } = useAnalysis();
const { t } = useI18n();

const container = ref<HTMLElement | null>(null);
const columns: Array<{ col: HTMLElement; bar: HTMLElement }> = [];

function render(): void {
  const data = chroma.value ?? new Float32Array(12);
  const maxValue = Math.max(0.001, ...data);
  const toneSet = new Set(chord.value ? chord.value.tones : []);

  columns.forEach(({ col, bar }, index) => {
    const height = 5 + 95 * clamp(data[index] / maxValue, 0, 1);
    bar.style.height = `${height.toFixed(1)}%`;
    col.classList.toggle("is-tone", toneSet.has(index));
    col.classList.toggle("is-root", Boolean(chord.value && chord.value.root === index));
  });
}

onMounted(() => {
  if (!container.value) return;
  const fragment = document.createDocumentFragment();
  NOTE_NAMES.forEach((name) => {
    const col = document.createElement("div");
    col.className = "chroma-col";

    const rail = document.createElement("div");
    rail.className = "chroma-rail";

    const bar = document.createElement("div");
    bar.className = "chroma-bar";
    bar.style.height = "5%";
    rail.appendChild(bar);

    const label = document.createElement("div");
    label.className = "chroma-label";
    label.textContent = name;

    col.append(rail, label);
    fragment.appendChild(col);
    columns.push({ col, bar });
  });
  container.value.appendChild(fragment);
  render();
});

// Chroma updates arrive at spectral cadence (~105 ms); the bars are
// updated imperatively, so this subtree never re-renders via Vue.
watch(tick, render);
</script>

<template>
  <div ref="container" class="chroma" :aria-label="t('chromaAria')"></div>
</template>
