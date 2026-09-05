<script setup lang="ts">
/**
 * Ear training is one stage: hear the question, answer it, see whether you
 * were right, go again. Everything else — which kind, how you are doing —
 * sits around the edge and never interrupts the loop.
 *
 * It needs no microphone, only the output side of the audio layer.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import AnswerPad from "./components/AnswerPad.vue";
import SingStage from "./components/SingStage.vue";
import { releaseSing } from "./stores/sing.js";
import { EXERCISE_KINDS, type ExerciseKind } from "./domain/exercise.js";
import { accuracy } from "./domain/grade.js";
import type { IntervalKey } from "../../lib/interval.js";
import type { ChordTypeKey } from "../../lib/music-theory.js";
import {
  answer,
  exercise,
  hydrateEar,
  nextQuestion,
  progress,
  releaseEar,
  replay,
  resetProgress,
  session,
  setAuto,
  setKind
} from "./stores/ear.js";

const { t } = useI18n();

/**
 * Sight-singing is a mode of the same tool rather than a route of its own:
 * naming an interval and singing one are the same skill from two sides,
 * and the level you are at should carry across. It is the only mode that
 * needs the microphone, so the source bar appears only for it.
 */
const MODES = [...EXERCISE_KINDS, "sing"] as const;
type Mode = (typeof MODES)[number];

// Hydrate first, then take the mode from the restored session: two copies
// of "which kind of question" is one too many, and they drifted apart.
hydrateEar();
const mode = ref<Mode>(session.kind);
const singing = computed(() => mode.value === "sing");

function selectMode(next: Mode): void {
  mode.value = next;
  if (next !== "sing") setKind(next);
}

const stats = computed(() => progress[session.kind]);

const accuracyText = computed(() =>
  stats.value.recent.length
    ? t("earAccuracy", { percent: Math.round(accuracy(stats.value) * 100) })
    : t("earNoAttempts")
);

const answerText = computed(() => {
  const current = exercise.value;
  if (!current || session.answered === null) return "";
  if (session.correct) return t("earCorrect");
  const key = current.answer;
  const name =
    current.kind === "chord"
      ? t(`chordType.${key as ChordTypeKey}`)
      : current.kind === "scale"
        ? t(`scaleName.${key as "major"}`)
        : t(`interval.${key as IntervalKey}`);
  return t("earWrong", { answer: name });
});

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (singing.value) return;

  if (event.code === "Space") {
    event.preventDefault();
    // Space is the whole loop: hear it again, or move on once answered.
    if (session.answered === null) void replay();
    else nextQuestion();
    return;
  }

  // Number keys answer, so a whole session can be done from the keyboard.
  const digit = Number(event.key);
  if (Number.isInteger(digit) && digit >= 1 && exercise.value) {
    const choice = exercise.value.choices[digit - 1];
    if (choice) {
      event.preventDefault();
      answer(choice);
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  releaseEar();
  releaseSing();
});
</script>

<template>
  <div class="tool-bar" data-tool="ear">
    <div class="ear-kinds">
      <button
        v-for="entry in MODES"
        :key="entry"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': mode === entry }"
        :data-ear-kind="entry"
        @click="selectMode(entry)"
      >
        {{ t(`ear.kind.${entry}`) }}
      </button>
    </div>
    <p v-if="!singing" class="ear-stats" data-ear-stats>
      <span>{{ t("earLevel", { level: session.level }) }}</span>
      <span>{{ accuracyText }}</span>
      <span>{{ t("earAttempts", { count: stats.attempts }) }}</span>
      <span v-if="session.streak > 1">{{ t("earStreak", { count: session.streak }) }}</span>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': session.auto }"
        data-ear-auto
        @click="setAuto(!session.auto)"
      >
        {{ t("earAuto") }}
      </button>
      <button
        v-if="stats.attempts > 0"
        type="button"
        class="metro-chip"
        data-ear-reset
        @click="resetProgress"
      >
        {{ t("earReset") }}
      </button>
    </p>
  </div>

  <section v-if="singing" class="card ear-stage">
    <SingStage />
  </section>

  <section v-else class="card ear-stage">
    <button type="button" class="ear-play" :class="{ 'is-playing': session.playing }" @click="replay">
      <span aria-hidden="true">♪</span>
      <span class="ear-play-label">{{ session.playing ? t("earPlaying") : t("earReplay") }}</span>
    </button>

    <AnswerPad />

    <p class="ear-verdict" :class="{ 'is-right': session.correct, 'is-wrong': session.answered !== null && !session.correct }" data-ear-verdict>
      {{ answerText }}
    </p>

    <button
      type="button"
      class="metro-chip ear-next"
      :disabled="session.answered === null"
      data-ear-next
      @click="nextQuestion"
    >
      {{ session.countdown > 0 ? t("earNextIn", { seconds: session.countdown.toFixed(1) }) : t("earNext") }}
    </button>
  </section>

  <p class="footnote">
    <strong>{{ t("earTitle") }}：</strong><span>{{ t("earIntro") }}</span>
  </p>
</template>
