<script setup lang="ts">
/**
 * Ear training is one stage: hear the question, answer it, see whether you
 * were right, go again. Everything else — which kind, how you are doing —
 * sits around the edge and never interrupts the loop.
 *
 * It needs no microphone, only the output side of the audio layer.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import AnswerPad from "./components/AnswerPad.vue";
import { EXERCISE_KINDS, type ExerciseKind } from "./domain/exercise.js";
import { accuracy } from "./domain/grade.js";
import type { IntervalKey } from "../../lib/interval.js";
import type { ChordTypeKey } from "../../lib/music-theory.js";
import {
  exercise,
  hydrateEar,
  nextQuestion,
  progress,
  releaseEar,
  replay,
  session,
  setKind
} from "./stores/ear.js";

const { t } = useI18n();

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
  if (event.code === "Space") {
    event.preventDefault();
    // Space is the whole loop: hear it again, or move on once answered.
    if (session.answered === null) void replay();
    else nextQuestion();
  }
}

onMounted(() => {
  hydrateEar();
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  releaseEar();
});
</script>

<template>
  <div class="tool-bar" data-tool="ear">
    <div class="ear-kinds">
      <button
        v-for="kind in EXERCISE_KINDS"
        :key="kind"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': session.kind === kind }"
        :data-ear-kind="kind"
        @click="setKind(kind as ExerciseKind)"
      >
        {{ t(`ear.kind.${kind}`) }}
      </button>
    </div>
    <p class="ear-stats" data-ear-stats>
      <span>{{ t("earLevel", { level: session.level }) }}</span>
      <span>{{ accuracyText }}</span>
      <span v-if="session.streak > 1">{{ t("earStreak", { count: session.streak }) }}</span>
    </p>
  </div>

  <section class="card ear-stage">
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
      {{ t("earNext") }}
    </button>
  </section>

  <p class="footnote">
    <strong>{{ t("earTitle") }}：</strong><span>{{ t("earIntro") }}</span>
  </p>
</template>
