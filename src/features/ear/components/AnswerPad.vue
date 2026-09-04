<script setup lang="ts">
/**
 * The answer keypad. Choices keep their canonical order between questions:
 * a keypad that reshuffles turns an ear test into a reading test.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import type { IntervalKey } from "../../../lib/interval.js";
import type { ChordTypeKey } from "../../../lib/music-theory.js";
import { answer, exercise, session } from "../stores/ear.js";

const { t } = useI18n();

const choices = computed(() => exercise.value?.choices ?? []);

function label(choice: string): string {
  const kind = exercise.value?.kind;
  if (kind === "chord") return t(`chordType.${choice as ChordTypeKey}`);
  if (kind === "scale") return t(`scaleName.${choice as "major"}`);
  return t(`interval.${choice as IntervalKey}`);
}

function state(choice: string): string {
  if (session.answered === null) return "";
  if (choice === exercise.value?.answer) return "is-right";
  return session.answered === choice ? "is-wrong" : "";
}
</script>

<template>
  <div class="ear-pad" data-ear-pad>
    <button
      v-for="choice in choices"
      :key="choice"
      type="button"
      class="ear-choice"
      :class="state(choice)"
      :disabled="session.answered !== null"
      @click="answer(choice)"
    >
      {{ label(choice) }}
    </button>
  </div>
</template>
