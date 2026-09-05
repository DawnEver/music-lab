<script setup lang="ts">
/**
 * Sight-singing: one loop, one button.
 *
 * A rep is hear-the-tonic, count in, sing, see how it went — and then the
 * next line. None of those are steps a singer should have to press, so the
 * only transport control is start/stop; the tonic, the count-in, the
 * grading and the next line all happen inside it. What is left over is
 * either a setting (key, tempo, length) or something you only want while
 * stopped (preview the line, skip to another one).
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { useAudioInput } from "../../../composables/useAudioInput.js";
import { audioContext, sourceStore } from "../../../audio/source.js";
import { analysisSettings } from "../../../audio/analysis.js";
import { historyBuffer } from "../../../audio/history.js";
import { NOTE_NAMES, frequencyToMidi, midiToFrequency } from "../../../lib/music-theory.js";
import { bandFrequencies, SPECTROGRAM_BANDS } from "../../../lib/spectrogram.js";
import { colormapLut } from "../../../lib/colormap.js";
import { semitoneScale } from "../../../lib/plot/scale.js";
import { drawTrace } from "../../../lib/plot/trace.js";
import {
  beatSeconds,
  COUNT_IN_BEATS,
  melody,
  newMelody,
  previewMelody,
  releaseSing,
  setBars,
  setTempo,
  setTonic,
  sing,
  start,
  stop,
  takeWindow,
  targetSegments,
  verdict
} from "../stores/sing.js";

const { t } = useI18n();

// Sight-singing is the one ear-training mode that listens.
useAudioInput();

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

const countInBeats = COUNT_IN_BEATS;
const TONICS = [55, 57, 59, 60, 62, 64, 65, 67];
const TEMPOS = [56, 72, 88, 104];
const BAR_CHOICES = [1, 2, 4];

const scoreText = computed(() =>
  verdict.value ? `${Math.round(verdict.value.score * 100)}%` : ""
);

/** One line that says what is happening, in the words of the moment. */
const phaseText = computed(() => {
  if (sing.phase === "countIn" && sing.countIn > 0) return String(sing.countIn);
  if (sing.phase === "judged" && verdict.value) return t("singScore", { percent: scoreText.value });
  return t(`sing.phase.${sing.phase}`);
});

const phaseHint = computed(() => {
  if (sing.phase === "tonic") return tonicLabel(sing.tonicMidi);
  if (sing.phase === "judged") return octaveNote.value;
  if (!sing.running && sourceStore.mode === "idle") return t("singWillListen");
  return "";
});

/** Whole-octave misses are a range problem, and worth saying out loud. */
const octaveNote = computed(() => {
  const off = verdict.value?.notes.filter((note) => note.sung && note.octaveOff !== 0) ?? [];
  if (!off.length || off.length < (verdict.value?.notes.length ?? 0) / 2) return "";
  return t("singOctaveOff", { octaves: off[0].octaveOff });
});

function tonicLabel(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function verticalScale() {
  const current = melody.value;
  const tuning = analysisSettings.tuning;
  if (!current) return semitoneScale(52, 76, tuning);
  const written = current.notes.map((note) => note.midi);
  const sung = historyBuffer
    .columns()
    .map((column) => column.pitchHz)
    .filter((hz): hz is number => hz !== null)
    .map((hz) => frequencyToMidi(hz, tuning));
  const all = sung.length ? [...written, ...sung] : written;
  const low = Math.floor(Math.min(...all)) - 3;
  const high = Math.ceil(Math.max(...all)) + 3;
  return semitoneScale(Math.max(24, low), Math.min(96, Math.max(high, low + 12)), tuning);
}

function frame(): void {
  if (canvas.value && wrap.value) {
    const now = audioContext()?.currentTime ?? 0;
    const { start: from, end: to } = takeWindow(now);
    drawTrace({
      canvas: canvas.value,
      wrap: wrap.value,
      columns: historyBuffer.window(to, to - from),
      startTime: from,
      endTime: to,
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
      playheadTime: sing.phase === "recording" ? now : null,
      tuning: analysisSettings.tuning
    });
  }
  animationId = requestAnimationFrame(frame);
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  }
}

function toggle(): void {
  if (sing.running) stop();
  else void start();
}

onMounted(() => {
  if (!melody.value) newMelody();
  window.addEventListener("keydown", onKeydown);
  animationId = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  animationId = 0;
  window.removeEventListener("keydown", onKeydown);
  releaseSing();
});
</script>

<template>
  <div class="sing-stage">
    <div
      ref="wrap"
      class="trace-wrap sing-wrap"
      data-sing-canvas
      :data-sing-phase="sing.phase"
      :data-sing-plan="melody ? JSON.stringify(melody.notes) : null"
      :data-sing-beat="beatSeconds()"
      :data-sing-countin="countInBeats"
    >
      <canvas ref="canvas"></canvas>
    </div>

    <!-- One transport, one line of state. Everything inside a rep runs
         itself, so there is nothing else to press mid-loop. -->
    <div class="sing-transport">
      <button
        type="button"
        class="sing-go"
        :class="{ 'is-running': sing.running }"
        data-sing-start
        @click="toggle"
      >
        <span aria-hidden="true">{{ sing.running ? "■" : "▶" }}</span>
        <span>{{ sing.running ? t("singStop") : t("singStart") }}</span>
      </button>

      <p
        class="sing-phase"
        data-sing-verdict
        :data-sing-notes="verdict ? verdict.notes.map((note) => note.grade).join(',') : null"
        :data-sing-cents="verdict ? verdict.notes.map((note) => (note.centsOff === null ? 'x' : Math.round(note.centsOff))).join(',') : null"
        :data-sing-octaves="verdict ? verdict.notes.map((note) => note.octaveOff).join(',') : null"
      >
        <span class="sing-phase-main" :class="{ 'is-count': sing.phase === 'countIn' }">
          {{ phaseText }}
        </span>
        <span v-if="phaseHint" class="sing-phase-hint">{{ phaseHint }}</span>
      </p>
    </div>

    <div class="trace-toggles sing-setup">
      <button
        type="button"
        class="metro-chip"
        :disabled="sing.running"
        data-sing-preview
        @click="previewMelody"
      >
        {{ t("singHear") }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :disabled="sing.running"
        data-sing-new
        @click="newMelody"
      >
        {{ t("singNew") }}
      </button>

      <span class="trace-group-label">{{ t("singKey") }}</span>
      <button
        v-for="midi in TONICS"
        :key="midi"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': sing.tonicMidi === midi }"
        @click="setTonic(midi)"
      >
        {{ tonicLabel(midi) }}
      </button>

      <span class="trace-group-label">{{ t("singTempo") }}</span>
      <button
        v-for="bpm in TEMPOS"
        :key="bpm"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': sing.bpm === bpm }"
        @click="setTempo(bpm)"
      >
        {{ bpm }}
      </button>

      <span class="trace-group-label">{{ t("singBars") }}</span>
      <button
        v-for="bars in BAR_CHOICES"
        :key="bars"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': sing.bars === bars }"
        @click="setBars(bars)"
      >
        {{ bars }}
      </button>
    </div>
  </div>
</template>
