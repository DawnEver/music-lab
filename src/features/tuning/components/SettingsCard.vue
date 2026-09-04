<script setup lang="ts">
import { analysisSettings, applyStability, persistAnalysisSettings } from "../../../audio/analysis.js";
import { useI18n } from "../../../composables/useI18n.js";
import CollapsibleCard from "../../../shared/components/CollapsibleCard.vue";

const { t } = useI18n();

function onTuning(value: number | null): void {
  if (value == null) return;
  analysisSettings.tuning = value;
  persistAnalysisSettings();
}

function onGate(value: number | null): void {
  if (value == null) return;
  analysisSettings.gateDb = value;
  persistAnalysisSettings();
}

function onStability(value: number | null): void {
  // Stability drives the analyser's smoothing as well as the pipeline's,
  // so it goes through the one function that owns both.
  if (value != null) applyStability(value / 100);
}
</script>

<template>
  <CollapsibleCard
    panel-id="settings"
    :title="t('settingsTitle')"
    panel-class="card--wide card--stack"
  >
    <div class="control-group">
      <div class="sliders">
        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("tuning") }}</span>
            <output class="slider-output">{{ analysisSettings.tuning }} Hz</output>
          </div>
          <v-slider
            :min="432"
            :max="446"
            :step="1"
            :model-value="analysisSettings.tuning"
            hide-details
            density="compact"
            @update:model-value="onTuning"
          />
        </div>

        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("noiseGate") }}</span>
            <output class="slider-output">{{ String(analysisSettings.gateDb).replace("-", "−") }} dB</output>
          </div>
          <v-slider
            :min="-70"
            :max="-28"
            :step="1"
            :model-value="analysisSettings.gateDb"
            hide-details
            density="compact"
            @update:model-value="onGate"
          />
        </div>

        <div class="slider-field">
          <div class="slider-head">
            <span class="slider-label">{{ t("stability") }}</span>
            <output class="slider-output">{{ Math.round(analysisSettings.stability * 100) }}%</output>
          </div>
          <v-slider
            :min="20"
            :max="92"
            :step="1"
            :model-value="Math.round(analysisSettings.stability * 100)"
            hide-details
            density="compact"
            @update:model-value="onStability"
          />
        </div>
      </div>
    </div>
  </CollapsibleCard>
</template>
