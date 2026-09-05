<script setup lang="ts">
/**
 * The time view, as a component.
 *
 * The trace tool and sight-singing draw the same picture from the same
 * history — one adds a heat map and a colour bar, the other adds the
 * written line — so the canvas, the rAF loop, the vertical scale and the
 * pointer readout live here once. Features supply what differs.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { audioContext } from "../../audio/source.js";
import { analysisSettings } from "../../audio/analysis.js";
import { historyBuffer, HISTORY_MAX_HZ, HISTORY_MIN_HZ } from "../../audio/history.js";
import { bandFrequencies, SPECTROGRAM_BANDS } from "../../lib/spectrogram.js";
import { colormapLut, defaultColormap, type ColormapId } from "../../lib/colormap.js";
import { frequencyToMidi } from "../../lib/music-theory.js";
import { logFrequencyScale, semitoneScale, type Scale } from "../../lib/plot/scale.js";
import { plotPolarity } from "../../lib/plot/palette.js";
import { devicePixelScale, plotBox } from "../../lib/plot/canvas.js";
import {
  drawTrace,
  readoutAt,
  TRACE_INSETS,
  type ReferenceLine,
  type TargetSegment,
  type TraceReadout
} from "../../lib/plot/trace.js";

const props = withDefaults(
  defineProps<{
    /** Seconds of history to show, when no explicit window is given. */
    window?: number;
    /** Explicit window, for replaying a fixed take. */
    range?: { start: number; end: number } | null;
    showSpectrogram?: boolean;
    showPitch?: boolean;
    semitoneAxis?: boolean;
    /** "auto" fits the content; numbers pin the axis. */
    lowMidi?: number | "auto";
    highMidi?: number | "auto";
    colormap?: ColormapId | "auto";
    floorDb?: number;
    ceilingDb?: number;
    references?: ReferenceLine[];
    targets?: TargetSegment[];
    playheadTime?: number | null;
    /** Extra notes the axis must contain even before anything is heard. */
    mustContain?: number[];
  }>(),
  {
    window: 10,
    range: null,
    showSpectrogram: true,
    showPitch: true,
    semitoneAxis: false,
    lowMidi: "auto",
    highMidi: "auto",
    colormap: "auto",
    floorDb: -90,
    ceilingDb: -20,
    references: () => [],
    targets: () => [],
    playheadTime: null,
    mustContain: () => []
  }
);

const emit = defineEmits<{ (event: "readout", value: TraceReadout | null): void }>();

const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationId = 0;

const centres = bandFrequencies({
  sampleRate: 48000,
  fftSize: 2048,
  minHz: HISTORY_MIN_HZ,
  maxHz: HISTORY_MAX_HZ,
  bands: SPECTROGRAM_BANDS
});

function resolvedColormap(): ColormapId {
  return props.colormap === "auto" ? defaultColormap(plotPolarity()) : props.colormap;
}

let lut = colormapLut(resolvedColormap());
let lutFor = resolvedColormap();

function refreshColormap(): void {
  const id = resolvedColormap();
  if (id === lutFor) return;
  lutFor = id;
  lut = colormapLut(id);
}

watch(() => props.colormap, refreshColormap);

function currentWindow(): { start: number; end: number } {
  if (props.range) return props.range;
  const span = historyBuffer.span();
  const now = audioContext()?.currentTime ?? span?.end ?? 0;
  return { start: now - props.window, end: now };
}

/** Pinned limits win; otherwise the axis fits what there is to show. */
function verticalScale(): Scale {
  const tuning = analysisSettings.tuning;
  if (!props.semitoneAxis) return logFrequencyScale(HISTORY_MIN_HZ, HISTORY_MAX_HZ);
  if (props.lowMidi !== "auto" && props.highMidi !== "auto") {
    return semitoneScale(props.lowMidi, props.highMidi, tuning);
  }

  const heard = historyBuffer
    .columns()
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null)
    .map((hz) => frequencyToMidi(hz, tuning));
  const all = [...heard, ...props.mustContain];
  if (!all.length) return semitoneScale(48, 84, tuning);
  const low = props.lowMidi === "auto" ? Math.floor(Math.min(...all)) - 3 : props.lowMidi;
  const high = props.highMidi === "auto" ? Math.ceil(Math.max(...all)) + 3 : props.highMidi;
  return semitoneScale(Math.max(12, low), Math.min(120, Math.max(high, low + 12)), tuning);
}

function frame(): void {
  if (canvas.value && wrap.value) {
    refreshColormap();
    const { start, end } = currentWindow();
    drawTrace({
      canvas: canvas.value,
      wrap: wrap.value,
      columns: historyBuffer.window(end, end - start),
      startTime: start,
      endTime: end,
      frequency: verticalScale(),
      semitoneAxis: props.semitoneAxis,
      bandCentres: centres,
      floorDb: props.floorDb,
      ceilingDb: props.ceilingDb,
      lut,
      showSpectrogram: props.showSpectrogram,
      showPitch: props.showPitch,
      references: props.references,
      targets: props.targets,
      playheadTime: props.playheadTime,
      tuning: analysisSettings.tuning
    });
  }
  animationId = requestAnimationFrame(frame);
}

function onPointerMove(event: PointerEvent): void {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  const dpr = devicePixelScale();
  const { start, end } = currentWindow();
  emit(
    "readout",
    readoutAt((event.clientX - rect.left) * dpr, (event.clientY - rect.top) * dpr, {
      area: plotBox(canvas.value.width, canvas.value.height, TRACE_INSETS),
      frequency: verticalScale(),
      bandCentres: centres,
      columns: historyBuffer.window(end, end - start),
      startTime: start,
      endTime: end,
      tuning: analysisSettings.tuning
    })
  );
}

onMounted(() => {
  animationId = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  animationId = 0;
});

defineExpose({ currentWindow });
</script>

<template>
  <div ref="wrap" class="trace-wrap">
    <canvas
      ref="canvas"
      @pointermove="onPointerMove"
      @pointerleave="emit('readout', null)"
    ></canvas>
  </div>
</template>
