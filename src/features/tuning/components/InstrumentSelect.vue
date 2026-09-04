<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { useTuner } from "../stores/tuner.js";
import { instrumentCategories, instrumentsByCategory } from "../../../instruments/index.js";

const { t, lang } = useI18n();
const tuner = useTuner();

// One subheader per category, so ~20 instruments stay scannable.
const instrumentItems = computed(() =>
  instrumentCategories.flatMap((category) => {
    const items = instrumentsByCategory(category);
    if (!items.length) return [];
    return [
      { type: "subheader" as const, title: t(`tuner.category.${category}`) },
      ...items.map((instrument) => ({ title: instrument.name[lang.value], value: instrument.id }))
    ];
  })
);

const variantItems = computed(
  () =>
    tuner.instrument.value?.variants?.map((item) => ({
      title: item.name[lang.value],
      value: item.id
    })) ?? []
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
      v-if="variantItems.length"
      :items="variantItems"
      :model-value="tuner.variant.value?.id"
      :label="t('tunerSelectHarpTuning')"
      density="compact"
      hide-details
      @update:model-value="tuner.setVariant(String($event))"
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
