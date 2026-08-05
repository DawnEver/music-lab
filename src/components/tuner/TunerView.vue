<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import { useTuner } from "../../composables/useTuner.js";
import InstrumentSelect from "./InstrumentSelect.vue";
import TunerBigNeedle from "./TunerBigNeedle.vue";
import StringsPanel from "./StringsPanel.vue";
import HarmonicaPanel from "./HarmonicaPanel.vue";

const { t } = useI18n();
const tuner = useTuner();

onMounted(() => tuner.activateTuner());
onBeforeUnmount(() => tuner.deactivateTuner());
</script>

<template>
  <section class="card tuner-card" aria-labelledby="tunerTitle">
    <div class="card-head">
      <div>
        <p class="section-label">{{ t("navTuner") }}</p>
        <h2 class="section-title" id="tunerTitle">{{ t("tunerTitle") }}</h2>
      </div>
    </div>

    <InstrumentSelect />

    <TunerBigNeedle />

    <StringsPanel v-if="tuner.instrument.value?.layout === 'strings'" />
    <HarmonicaPanel v-else />

    <p class="tuner-hint">{{ t("tunerOneNoteNote") }}</p>
  </section>
</template>
