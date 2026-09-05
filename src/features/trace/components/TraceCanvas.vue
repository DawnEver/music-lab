<script setup lang="ts">
/**
 * The trace tool's plot: the shared time view, wired to this tool's
 * settings, plus the one thing only this tool does — scrubbing a frozen
 * view back through the history it kept.
 */
import { computed, ref } from "vue";
import TracePlot from "../../../shared/components/TracePlot.vue";
import { analysisSettings } from "../../../audio/analysis.js";
import { historyBuffer, historyRunning } from "../../../audio/history.js";
import { midiToFrequency } from "../../../lib/music-theory.js";
import { referenceLabel, type ReferenceLine, type TraceReadout } from "../../../lib/plot/trace.js";
import { reference } from "../../../shared/stores/reference.js";
import { playback, traceView } from "../stores/trace.js";

/** What the tuner is working on wins, if the player asked to follow it. */
function referenceMidi(): number | null {
  if (traceView.followTuner && reference.current) return reference.current.midi;
  return traceView.referenceMidi;
}

const references = computed<ReferenceLine[]>(() => {
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
});

/**
 * Live follows the right edge; a frozen view holds still and can scrub.
 * Evaluated per frame, because the audio clock is not reactive.
 */
function range(now: number): { start: number; end: number } {
  const span = historyBuffer.span();
  const live = historyRunning() ? now : span?.end ?? now;
  const end = playback.frozenAt ?? live;
  return { start: end - traceView.window, end };
}

function onReadout(value: TraceReadout | null): void {
  playback.hover = value
    ? { time: value.time, note: value.note, hz: value.hz, db: value.db }
    : null;
}

const scrubbing = ref(false);
let scrubFrom = { x: 0, at: 0 };

function onPointerDown(event: PointerEvent): void {
  if (playback.frozenAt === null) return;
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  scrubbing.value = true;
  scrubFrom = { x: event.clientX, at: playback.frozenAt };
}

function onScrub(event: PointerEvent): void {
  if (!scrubbing.value) return;
  const width = (event.currentTarget as HTMLElement).getBoundingClientRect().width;
  const seconds = ((scrubFrom.x - event.clientX) / width) * traceView.window;
  const span = historyBuffer.span();
  if (!span) return;
  playback.frozenAt = Math.min(
    span.end,
    Math.max(span.start + traceView.window, scrubFrom.at - seconds)
  );
}
</script>

<template>
  <div
    class="trace-plot-host"
    data-trace-canvas
    @pointerdown="onPointerDown"
    @pointermove="onScrub"
    @pointerup="scrubbing = false"
    @pointerleave="scrubbing = false"
  >
    <TracePlot
      :range="range"
      :window="traceView.window"
      :show-spectrogram="traceView.showSpectrogram"
      :show-pitch="traceView.showPitch"
      :semitone-axis="traceView.scale === 'semitone'"
      :low-midi="traceView.lowMidi"
      :high-midi="traceView.highMidi"
      :colormap="traceView.colormap"
      :floor-db="traceView.floorDb"
      :ceiling-db="traceView.ceilingDb"
      :references="references"
      :playhead-time="playback.frozenAt"
      @readout="onReadout"
    />
  </div>
</template>
