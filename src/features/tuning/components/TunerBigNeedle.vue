<script setup lang="ts">
import { computed } from "vue";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import { useI18n } from "../../../composables/useI18n.js";
import { useTuner } from "../stores/tuner.js";
import CentsGauge from "./CentsGauge.vue";

const { t, lang } = useI18n();
const tuner = useTuner();

const target = computed(() => tuner.needleTarget.value);

const noteName = computed(() => {
  if (!target.value) return "—";
  const midi = target.value.midi;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
});

const targetText = computed(() => {
  const value = target.value;
  if (!value) return "";

  // Grid targets read "hole 3 · draw · bend 2"; list targets are just the
  // string / tine label.
  const slot = value.target.slot;
  if (!slot) return value.label[lang.value];

  const { kind, bendLevel } = value.position;
  const kindKey =
    kind === "bend"
      ? (bendLevel ?? 0) >= 3
        ? "tuner.kind.deepBend"
        : "tuner.kind.bend"
      : `tuner.kind.${kind}`;
  const parts = [t("tunerHole", { hole: slot.row }), t(`tuner.kind.${slot.column}`)];
  if (kind !== slot.column) parts.push(t(kindKey, { level: bendLevel ?? 0 }));
  return parts.join(" · ");
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
      <span class="tuner-big-conf">{{ t("confidence") }} {{ confidenceText }}</span>
    </div>
    <CentsGauge :cents="target ? target.cents : 0" />
  </div>
</template>
