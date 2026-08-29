<script setup lang="ts">
/**
 * Meter picker. Presets cover the usual simple/compound/additive meters;
 * the grouping field expresses anything else (7/8 as 2+2+3 or 3+2+2).
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import { METER_PRESETS } from "../domain/presets.js";
import { makeMeter, meterLabel, metersEqual, parseGroups, type Denominator } from "../domain/meter.js";
import { metronome, setMeter, resetAccents } from "../stores/metronome.js";

const { t } = useI18n();
const DENOMINATORS: Denominator[] = [2, 4, 8, 16];

const groupsInput = ref(metronome.meter.groups.join("+"));
const invalid = ref(false);

watch(
  () => metronome.meter,
  (meter) => {
    groupsInput.value = meter.groups.join("+");
    invalid.value = false;
  }
);

const grouped = computed(() =>
  (["simple", "compound", "additive"] as const).map((group) => ({
    group,
    presets: METER_PRESETS.filter((preset) => preset.group === group)
  }))
);

function apply(): void {
  const groups = parseGroups(groupsInput.value);
  if (!groups) {
    invalid.value = true;
    return;
  }
  invalid.value = false;
  setMeter(makeMeter(metronome.meter.denominator, groups));
}

function setDenominator(denominator: Denominator): void {
  setMeter(makeMeter(denominator, metronome.meter.groups));
}
</script>

<template>
  <div class="control-group metro-meter">
    <div v-for="row in grouped" :key="row.group" class="metro-field">
      <span class="slider-label">{{ t(`meterGroup.${row.group}`) }}</span>
      <div class="metro-chips">
        <button
          v-for="preset in row.presets"
          :key="meterLabel(preset.meter)"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metersEqual(metronome.meter, preset.meter) }"
          @click="setMeter(preset.meter)"
        >
          {{ meterLabel(preset.meter) }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("metroDenominator") }}</span>
      <div class="metro-chips">
        <button
          v-for="denominator in DENOMINATORS"
          :key="denominator"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': metronome.meter.denominator === denominator }"
          @click="setDenominator(denominator)"
        >
          /{{ denominator }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("metroCustomGroups") }}</span>
      <div class="metro-groups-row">
        <input
          v-model="groupsInput"
          class="metro-input"
          type="text"
          inputmode="numeric"
          :aria-label="t('metroCustomGroups')"
          :placeholder="t('metroCustomHint')"
          @keydown.enter="apply"
        />
        <button type="button" class="metro-chip is-action" @click="apply">
          {{ t("metroCustomApply") }}
        </button>
      </div>
      <p class="metro-hint" :class="{ 'is-error': invalid }">
        {{ invalid ? t("metroCustomInvalid") : t("metroCustomHint") }}
      </p>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("accentTitle") }}</span>
      <div class="metro-chips">
        <button type="button" class="metro-chip is-action" @click="resetAccents">
          {{ t("metroAccentReset") }}
        </button>
      </div>
      <p class="metro-hint">{{ t("metroAccentHint") }}</p>
    </div>
  </div>
</template>
