<script setup lang="ts">
/**
 * The trace canvas. Drawing is imperative and driven by rAF over the
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
import {
  drawTrace,
  readoutAt,
  referenceLabel,
  TRACE_INSETS,
  type ReferenceLine
} from "../../../lib/plot/trace.js";
import { devicePixelScale, plotBox } from "../../../lib/plot/canvas.js";
import { frequencyToMidi, midiToFrequency } from "../../../lib/music-theory.js";
import { playback, traceView } from "../stores/trace.js";
import { reference } from "../../../shared/stores/reference.js";

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationId = 0;
let lut = colormapLut(traceView.colormap);

// Band centres never change while the app runs; the LUT only on request.
const centres = bandFrequencies({
  sampleRate: 48000,
  fftSize: 2048,
  minHz: HISTORY_MIN_HZ,
  maxHz: HISTORY_MAX_HZ,
  bands: SPECTROGRAM_BANDS
});

watch(
  () => traceView.colormap,
  (id) => {
    lut = colormapLut(id);
  }
);

/** Semitone axis spans the retained pitch material, padded a little. */
function verticalScale() {
  if (traceView.scale === "log") return logFrequencyScale(HISTORY_MIN_HZ, HISTORY_MAX_HZ);
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

/** What the tuner is working on wins, if the player asked to follow it. */
function referenceMidi(): number | null {
  if (traceView.followTuner && reference.current) return reference.current.midi;
  return traceView.referenceMidi;
}

function references(): ReferenceLine[] {
  const midi = referenceMidi();
  if (midi === null) return [];
  const tuning = analysisSettings.tuning;
  const hz = midiToFrequency(midi, tuning);
  const lines: ReferenceLine[] = [
    { hz, label: referenceLabel(midi, tuning), kind: "reference" }
  ];
  if (traceView.showHarmonics) {
    for (const multiple of [2, 3, 4]) {
      lines.push({ hz: hz * multiple, label: `${multiple}×`, kind: "harmonic" });
    }
  }
  return lines;
}

/** The window currently on screen; hit-testing must use the same one. */
function currentWindow(): { startTime: number; endTime: number } {
  const span = historyBuffer.span();
  const live = audioContext()?.currentTime ?? span?.end ?? 0;
  const endTime = playback.frozenAt ?? (historyRunning() ? live : span?.end ?? 0);
  return { startTime: endTime - traceView.window, endTime };
}

/**
 * Pointer readout. The numbers come from the same scales the frame was
 * drawn with, so the tooltip cannot disagree with the picture.
 */
function onPointerMove(event: PointerEvent): void {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  const dpr = devicePixelScale();
  const { startTime, endTime } = currentWindow();
  const readout = readoutAt(
    (event.clientX - rect.left) * dpr,
    (event.clientY - rect.top) * dpr,
    {
      area: plotBox(canvas.value.width, canvas.value.height, TRACE_INSETS),
      frequency: verticalScale(),
      bandCentres: centres,
      columns: historyBuffer.window(endTime, traceView.window),
      startTime,
      endTime,
      tuning: analysisSettings.tuning
    }
  );
  playback.hover = readout
    ? { time: readout.time, note: readout.note, hz: readout.hz, db: readout.db }
    : null;
}

function onPointerLeave(): void {
  playback.hover = null;
}

/** Scrubbing a frozen view: drag moves the end of the window. */
function onPointerDown(event: PointerEvent): void {
  if (playback.frozenAt === null || !canvas.value) return;
  canvas.value.setPointerCapture(event.pointerId);
  scrubbing = true;
  scrubFrom = { x: event.clientX, at: playback.frozenAt };
}

function onPointerUp(event: PointerEvent): void {
  if (!scrubbing || !canvas.value) return;
  canvas.value.releasePointerCapture(event.pointerId);
  scrubbing = false;
}

function onScrub(event: PointerEvent): void {
  if (!scrubbing || !canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  const seconds = ((scrubFrom.x - event.clientX) / rect.width) * traceView.window;
  const span = historyBuffer.span();
  if (!span) return;
  playback.frozenAt = Math.min(
    span.end,
    Math.max(span.start + traceView.window, scrubFrom.at - seconds)
  );
}

let scrubbing = false;
let scrubFrom = { x: 0, at: 0 };

function frame(): void {
  if (canvas.value && wrap.value) {
    const { startTime, endTime } = currentWindow();
    drawTrace({
      canvas: canvas.value,
      wrap: wrap.value,
      columns: historyBuffer.window(endTime, traceView.window),
      startTime,
      endTime,
      frequency: verticalScale(),
      semitoneAxis: traceView.scale === "semitone",
      bandCentres: centres,
      floorDb: traceView.floorDb,
      ceilingDb: traceView.ceilingDb,
      lut,
      showSpectrogram: traceView.showSpectrogram,
      showPitch: traceView.showPitch,
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
  <div ref="wrap" class="trace-wrap" data-trace-canvas>
    <canvas
      ref="canvas"
      @pointermove="onPointerMove($event); onScrub($event)"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    ></canvas>
  </div>
</template>
