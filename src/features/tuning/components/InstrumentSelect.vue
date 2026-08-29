<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { useTuner } from "../../../composables/useTuner.js";
import { allInstruments } from "../../../instruments/index.js";

const { t, lang } = useI18n();
const tuner = useTuner();

const instrumentItems = computed(() =>
  allInstruments.map((instrument) => ({
    title: instrument.name[lang.value],
    value: instrument.id
  }))
);

const presetItems = computed(
  () =>
    tuner.instrument.value?.presets.map((preset) => ({
      title: preset.name[lang.value],
      value: preset.id
    })) ?? []
);
</script>

<template>
  <div class="tuner-controls">
    <v-select
      :items="instrumentItems"
      :model-value="tuner.instrumentId.value"
      :label="t('tunerSelectInstrument')"
      density="compact"
      hide-details
      @update:model-value="tuner.setInstrument(String($event))"
    />
    <v-select
      :items="presetItems"
      :model-value="tuner.presetId.value"
      :label="t('tunerSelectTuning')"
      density="compact"
      hide-details
      @update:model-value="tuner.setPreset(String($event))"
    />
    <div class="tuner-auto" :title="t('tunerAutoHint')">
      <v-switch
        :model-value="tuner.autoMode.value"
        color="secondary"
        density="compact"
        hide-details
        @update:model-value="tuner.toggleAuto()"
      />
      <span>{{ t("tunerAuto") }}</span>
    </div>
  </div>
</template>
