<script setup lang="ts">
import { computed } from "vue";
import { NOTE_NAMES } from "../../lib/music-theory.js";
import { clamp } from "../../lib/dsp.js";
import { useI18n } from "../../composables/useI18n.js";
import { useTuner } from "../../composables/useTuner.js";
import TunerNeedle from "../TunerNeedle.vue";

const { t, lang } = useI18n();
const tuner = useTuner();

const target = computed(() => tuner.needleTarget.value);

const noteName = computed(() => {
  if (!target.value) return "—";
  const midi = target.value.midi;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
});

const centsText = computed(() => {
  if (!target.value) return "0 cent";
  const rounded = Math.round(target.value.cents);
  const prefix = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)} cent`;
});

const targetText = computed(() => {
  const value = target.value;
  if (!value) return "";
  if (value.label) return value.label[lang.value];
  if (value.position) {
    const kindKey =
      value.position.kind === "bend"
        ? (value.position.bendLevel ?? 0) >= 3
          ? "tuner.kind.deepBend"
          : "tuner.kind.bend"
        : `tuner.kind.${value.position.kind}`;
    const kindText = t(kindKey, { level: value.position.bendLevel ?? 0 });
    return `${t("tunerHole", { hole: value.hole })} · ${
      value.breath === "blow" ? t("tunerBlow") : t("tunerDraw")
    } · ${kindText}`;
  }
  return "";
});

const frequencyText = computed(() =>
  target.value
    ? `${target.value.frequency.toFixed(target.value.frequency < 100 ? 2 : 1)} Hz`
    : "— Hz"
);

const confidenceText = computed(() =>
  target.value ? `${Math.round(target.value.confidence * 100)}%` : "0%"
);
</script>

<template>
  <div class="tuner-big">
    <div class="tuner-big-head">
      <div class="tuner-big-note">{{ noteName }}</div>
      <div class="tuner-big-target">{{ targetText || t("tunerNoTarget") }}</div>
    </div>
    <div class="tuner-big-readout">
      <span class="tuner-big-freq">{{ t("tunerActual") }} {{ frequencyText }}</span>
      <span class="cents-value">{{ centsText }}</span>
      <span class="tuner-big-conf">{{ t("confidence") }} {{ confidenceText }}</span>
    </div>
    <TunerNeedle :cents="target ? clamp(target.cents, -50, 50) : 0" />
  </div>
</template>
