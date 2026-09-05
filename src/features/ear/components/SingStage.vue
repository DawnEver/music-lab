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
import TracePlot from "../../../shared/components/TracePlot.vue";
import Score from "./Score.vue";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import { storedJson } from "../../../lib/persist.js";

/** Which notation the singer reads; remembered between sessions. */
const storedNotation = storedJson<"staff" | "jianpu">(
  "ear.notation",
  () => "staff",
  (raw, base) => (raw === "jianpu" || raw === "staff" ? raw : base)
);
import {
  beatSeconds,
  COUNT_IN_BEATS,
  hydrateSing,
  registerShift,
  setRegister,
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
  previewAnchor,
  takeWindow,
  targetSegments,
  verdict,
  type Register
} from "../stores/sing.js";

const { t } = useI18n();

hydrateSing();

const notation = ref<"staff" | "jianpu">(readNotation());

const NOTATIONS: Array<"staff" | "jianpu"> = ["staff", "jianpu"];
const REGISTERS: Register[] = ["written", "octaveDown"];

function readNotation(): "staff" | "jianpu" {
  return storedNotation.read();
}

function setNotation(value: "staff" | "jianpu"): void {
  notation.value = value;
  storedNotation.write(value);
}

// Sight-singing is the one ear-training mode that listens.
useAudioInput();


const countInBeats = COUNT_IN_BEATS;

/** Which note is under the cursor right now, so the score can follow. */
const activeIndex = computed(() => {
  if (sing.phase !== "recording" || !melody.value || !sing.startedAt) return null;
  const elapsed = (audioContext()?.currentTime ?? 0) - sing.startedAt;
  const index = melody.value.notes.findIndex(
    (note) => elapsed >= note.start && elapsed < note.start + note.duration
  );
  return index >= 0 ? index : null;
});

const noteGrades = computed(() => verdict.value?.notes.map((note) => note.grade) ?? []);
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

/** The window is the take: the written line decides what is on screen. */
const range = (now: number) => takeWindow(now);

/** Read the line before you sing it: drawn in place even while stopped. */
function plannedTargets() {
  const now = audioContext()?.currentTime ?? 0;
  return targetSegments(sing.startedAt || previewAnchor(now));
}
const writtenNotes = computed(() => melody.value?.notes.map((note) => note.midi) ?? []);

onMounted(() => {
  if (!melody.value) newMelody();
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  releaseSing();
});
</script>

<template>
  <div class="sing-stage">
    <!-- What to sing comes first; what came out is underneath it. -->
    <Score
      :melody="melody"
      :notation="notation"
      :octave-shift="registerShift()"
      :grades="noteGrades"
      :active-index="activeIndex"
    />

    <div
      class="sing-wrap"
      data-sing-canvas
      :data-sing-phase="sing.phase"
      :data-sing-plan="melody ? JSON.stringify(melody.notes) : null"
      :data-sing-beat="beatSeconds()"
      :data-sing-countin="countInBeats"
    >
      <TracePlot
        :range="range"
        semitone-axis
        :show-spectrogram="false"
        :must-contain="writtenNotes"
        :targets="plannedTargets()"
        :playhead-time="sing.phase === 'recording' ? audioContext()?.currentTime ?? null : null"
      />
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

    <!-- Grouped by the question being answered, not by what happens to be
         a toggle: what am I reading, what am I singing, what do I do now. -->
    <div class="sing-controls">
      <div class="sing-group">
        <span class="trace-group-label">{{ t("singRead") }}</span>
        <button
          v-for="value in NOTATIONS"
          :key="value"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': notation === value }"
          :data-sing-notation="value"
          @click="setNotation(value)"
        >
          {{ t(`singNotation.${value}`) }}
        </button>
      </div>

      <div class="sing-group">
        <span class="trace-group-label">{{ t("singRegister") }}</span>
        <button
          v-for="value in REGISTERS"
          :key="value"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': sing.register === value }"
          :data-sing-register="value"
          @click="setRegister(value)"
        >
          {{ t(`singRegister.${value}`) }}
        </button>
      </div>

      <div class="sing-group">
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
      </div>

      <div class="sing-group">
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
      </div>

      <div class="sing-group">
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
  </div>
</template>
