<script setup lang="ts">
/**
 * The sight-singing stage: the written line and the sung line on one pair
 * of axes. Nothing here aligns anything — both come off the same clock, so
 * "did I hit it" is simply visible.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { audioContext, sourceStore } from "../../../audio/source.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { historyBuffer } from "../../../audio/history.js";
import { bandFrequencies, SPECTROGRAM_BANDS } from "../../../lib/spectrogram.js";
import { colormapLut } from "../../../lib/colormap.js";
import { semitoneScale } from "../../../lib/plot/scale.js";
import { drawScope } from "../../../lib/plot/scope.js";
import { frequencyToMidi } from "../../../lib/music-theory.js";
import { melodySeconds } from "../domain/melody.js";
import {
  cancelTake,
  melody,
  newMelody,
  playMelody,
  playTonic,
  sing,
  startTake,
  targetSegments,
  verdict
} from "../stores/sing.js";

const { t } = useI18n();

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationId = 0;
const lut = colormapLut("magma", 64);
const centres = bandFrequencies({
  sampleRate: 48000,
  fftSize: 2048,
  minHz: 40,
  maxHz: 12000,
  bands: SPECTROGRAM_BANDS
});

const scoreText = computed(() =>
  verdict.value ? `${Math.round(verdict.value.score * 100)}%` : ""
);

const phaseText = computed(() => t(`sing.phase.${sing.phase}`));

/** The window is the take: the written line decides what is on screen. */
function timeWindow(): { start: number; end: number } {
  const current = melody.value;
  const length = current ? melodySeconds(current) : 8;
  if (sing.startedAt) return { start: sing.startedAt - 1, end: sing.startedAt + length + 0.5 };
  const now = audioContext()?.currentTime ?? 0;
  return { start: now - length, end: now + 0.5 };
}

function verticalScale() {
  const current = melody.value;
  const tuning = analysisSettings.tuning;
  if (!current) return semitoneScale(52, 76, tuning);
  const midis = current.notes.map((note) => note.midi);
  const sungMidis = historyBuffer
    .columns()
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null)
    .map((hz) => frequencyToMidi(hz, tuning));
  const low = Math.floor(Math.min(...midis, ...(sungMidis.length ? sungMidis : midis))) - 3;
  const high = Math.ceil(Math.max(...midis, ...(sungMidis.length ? sungMidis : midis))) + 3;
  return semitoneScale(Math.max(24, low), Math.min(96, Math.max(high, low + 12)), tuning);
}

function frame(): void {
  if (canvas.value && wrap.value) {
    const { start, end } = timeWindow();
    drawScope({
      canvas: canvas.value,
      wrap: wrap.value,
      columns: historyBuffer.window(end, end - start),
      startTime: start,
      endTime: end,
      frequency: verticalScale(),
      semitoneAxis: true,
      bandCentres: centres,
      floorDb: -90,
      ceilingDb: -20,
      lut,
      // The written line is the point here; energy would only crowd it.
      showSpectrogram: false,
      showPitch: true,
      references: [],
      targets: targetSegments(),
      playheadTime: sing.phase === "recording" ? audioContext()?.currentTime ?? null : null,
      tuning: analysisSettings.tuning
    });
  }
  animationId = requestAnimationFrame(frame);
}

onMounted(() => {
  if (!melody.value) newMelody();
  animationId = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  animationId = 0;
  cancelTake();
});
</script>

<template>
  <div class="sing-stage">
    <div ref="wrap" class="scope-wrap" data-sing-canvas>
      <canvas ref="canvas"></canvas>
    </div>

    <p v-if="sourceStore.mode === 'idle'" class="ear-verdict" data-sing-hint>
      {{ t("singNeedsMic") }}
    </p>

    <div class="scope-toggles">
      <button type="button" class="metro-chip" data-sing-tonic @click="playTonic">
        {{ t("singTonic") }}
      </button>
      <button type="button" class="metro-chip" @click="playMelody">{{ t("singHear") }}</button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': sing.phase === 'recording' || sing.phase === 'countIn' }"
        :disabled="sourceStore.mode === 'idle'"
        data-sing-start
        @click="startTake"
      >
        {{ t("singStart") }}
      </button>
      <button type="button" class="metro-chip" data-sing-new @click="newMelody">
        {{ t("singNew") }}
      </button>
    </div>

    <p class="ear-verdict" data-sing-verdict>
      <span>{{ phaseText }}</span>
      <span v-if="verdict"> · {{ t("singScore", { percent: scoreText }) }}</span>
    </p>
  </div>
</template>
