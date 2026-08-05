<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import { useTuner } from "../../composables/useTuner.js";
import CollapsibleCard from "../CollapsibleCard.vue";
import InstrumentSelect from "./InstrumentSelect.vue";
import TunerBigNeedle from "./TunerBigNeedle.vue";
import StringsPanel from "./StringsPanel.vue";
import HarmonicaPanel from "./HarmonicaPanel.vue";

const { t } = useI18n();
const tuner = useTuner();

// Mount/unmount tracks panel expand/collapse: expanding activates the
// instrument's detector band, collapsing restores the default.
onMounted(() => tuner.activateTuner());
onBeforeUnmount(() => tuner.deactivateTuner());
</script>

<template>
  <CollapsibleCard
    panel-id="tuner"
    :label="t('navTuner')"
    :title="t('tunerTitle')"
    panel-class="tuner-card"
  >
    <InstrumentSelect />

    <div class="tuner-main">
      <TunerBigNeedle />

      <StringsPanel v-if="tuner.instrument.value?.layout === 'strings'" />
      <HarmonicaPanel v-else />
    </div>

    <p class="tuner-hint">{{ t("tunerOneNoteNote") }}</p>
  </CollapsibleCard>
</template>
