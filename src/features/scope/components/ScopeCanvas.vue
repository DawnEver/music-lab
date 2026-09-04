<script setup lang="ts">
/**
 * The scope canvas. Drawing is imperative and driven by rAF over the
 * history buffer — it never enters Vue reactivity, exactly like the
 * spectrum. Only the settings it reads are reactive.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { audioContext } from "../../../audio/source.js";
import {
  historyBuffer,
  HISTORY_MAX_HZ,
  HISTORY_MIN_HZ,
  historyRunning
} from "../../../audio/history.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { bandFrequencies, SPECTROGRAM_BANDS } from "../../../lib/spectrogram.js";
import { colormapLut } from "../../../lib/colormap.js";
import { logFrequencyScale, semitoneScale } from "../../../lib/plot/scale.js";
import { drawScope, referenceLabel, type ReferenceLine } from "../../../lib/plot/scope.js";
import { frequencyToMidi, midiToFrequency } from "../../../lib/music-theory.js";
import { playback, scope } from "../stores/scope.js";

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationId = 0;
let lut = colormapLut(scope.colormap);

// Band centres never change while the app runs; the LUT only on request.
const centres = bandFrequencies({
  sampleRate: 48000,
  fftSize: 2048,
  minHz: HISTORY_MIN_HZ,
  maxHz: HISTORY_MAX_HZ,
  bands: SPECTROGRAM_BANDS
});

watch(
  () => scope.colormap,
  (id) => {
    lut = colormapLut(id);
  }
);

/** Semitone axis spans the retained pitch material, padded a little. */
function verticalScale() {
  if (scope.scale === "log") return logFrequencyScale(HISTORY_MIN_HZ, HISTORY_MAX_HZ);
  const pitches = historyBuffer
    .columns()
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null);
  const tuning = analysisSettings.tuning;
  if (!pitches.length) return semitoneScale(40, 84, tuning);
  const low = Math.floor(frequencyToMidi(Math.min(...pitches), tuning)) - 5;
  const high = Math.ceil(frequencyToMidi(Math.max(...pitches), tuning)) + 5;
  return semitoneScale(Math.max(12, low), Math.min(120, Math.max(high, low + 12)), tuning);
}

function references(): ReferenceLine[] {
  if (scope.referenceMidi === null) return [];
  const tuning = analysisSettings.tuning;
  const hz = midiToFrequency(scope.referenceMidi, tuning);
  const lines: ReferenceLine[] = [
    { hz, label: referenceLabel(scope.referenceMidi, tuning), kind: "reference" }
  ];
  if (scope.showHarmonics) {
    for (const multiple of [2, 3, 4]) {
      lines.push({ hz: hz * multiple, label: `${multiple}×`, kind: "harmonic" });
    }
  }
  return lines;
}

function frame(): void {
  if (canvas.value && wrap.value) {
    const span = historyBuffer.span();
    const live = audioContext()?.currentTime ?? span?.end ?? 0;
    const endTime = playback.frozenAt ?? (historyRunning() ? live : span?.end ?? 0);
    const startTime = endTime - scope.window;
    drawScope({
      canvas: canvas.value,
      wrap: wrap.value,
      columns: historyBuffer.window(endTime, scope.window),
      startTime,
      endTime,
      frequency: verticalScale(),
      semitoneAxis: scope.scale === "semitone",
      bandCentres: centres,
      floorDb: scope.floorDb,
      ceilingDb: scope.ceilingDb,
      lut,
      showSpectrogram: scope.showSpectrogram,
      showPitch: scope.showPitch,
      references: references(),
      playheadTime: playback.frozenAt,
      tuning: analysisSettings.tuning
    });
  }
  animationId = requestAnimationFrame(frame);
}

onMounted(() => {
  animationId = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  animationId = 0;
});
</script>

<template>
  <div ref="wrap" class="scope-wrap" data-scope-canvas>
    <canvas ref="canvas"></canvas>
  </div>
</template>
