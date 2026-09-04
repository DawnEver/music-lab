<script setup lang="ts">
/**
 * Every knob the trace has, in one flat panel.
 *
 * On a wide screen this sits under the canvas and stays there: a dB floor
 * is something you nudge while watching the picture change, and hiding it
 * behind a popover makes that a two-step loop. On a phone there is no room
 * for both, so the same component is placed inside a sheet instead — one
 * definition, two placements.
 */
import { useI18n } from "../../../composables/useI18n.js";
import { COLORMAP_IDS, type ColormapId } from "../../../lib/colormap.js";
import { setHistoryResolution, type ResolutionId } from "../../../audio/history.js";
import { NOTE_NAMES } from "../../../lib/music-theory.js";
import { reference } from "../../../shared/stores/reference.js";
import {
  persistTrace,
  traceView,
  WINDOW_CHOICES,
  type TraceScale
} from "../stores/trace.js";

const { t } = useI18n();

const RESOLUTIONS: ResolutionId[] = ["time", "balanced", "frequency"];
const SCALES: TraceScale[] = ["log", "semitone"];
const OCTAVES = [1, 2, 3, 4, 5, 6];

function commit(): void {
  persistTrace();
}

function toggleLayer(layer: "showSpectrogram" | "showPitch"): void {
  // Never leave the canvas blank: turning off the last layer turns the
  // other one on.
  traceView[layer] = !traceView[layer];
  if (!traceView.showSpectrogram && !traceView.showPitch) {
    traceView[layer === "showSpectrogram" ? "showPitch" : "showSpectrogram"] = true;
  }
  commit();
}

function setResolution(id: ResolutionId): void {
  traceView.resolution = id;
  setHistoryResolution(id);
  commit();
}

function setColormap(id: ColormapId): void {
  traceView.colormap = id;
  commit();
}

function setFloor(value: number): void {
  // The floor may not cross the ceiling, or the ramp inverts.
  traceView.floorDb = Math.min(value, traceView.ceilingDb - 10);
  commit();
}

function setCeiling(value: number): void {
  traceView.ceilingDb = Math.max(value, traceView.floorDb + 10);
  commit();
}

const pitchClass = () => (traceView.referenceMidi ?? 69) % 12;
const octave = () => Math.floor((traceView.referenceMidi ?? 69) / 12) - 1;

function setReference(pc: number, oct: number): void {
  traceView.referenceMidi = (oct + 1) * 12 + pc;
  traceView.followTuner = false;
  commit();
}

function followTuner(): void {
  traceView.followTuner = true;
  commit();
}

function clearReference(): void {
  traceView.referenceMidi = null;
  traceView.followTuner = false;
  commit();
}
</script>

<template>
  <div class="trace-controls" data-trace-controls>
    <div class="trace-row">
      <span class="trace-group-label">{{ t("traceLayers") }}</span>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.showSpectrogram }"
        data-trace-layer="spectrogram"
        @click="toggleLayer('showSpectrogram')"
      >
        {{ t("traceLayerSpectrogram") }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.showPitch }"
        data-trace-layer="pitch"
        @click="toggleLayer('showPitch')"
      >
        {{ t("traceLayerPitch") }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.showSpectrum }"
        data-trace-layer="spectrum"
        @click="traceView.showSpectrum = !traceView.showSpectrum; commit()"
      >
        {{ t("traceLayerSpectrum") }}
      </button>

      <span class="trace-group-label">{{ t("traceScale") }}</span>
      <button
        v-for="value in SCALES"
        :key="value"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.scale === value }"
        :data-trace-scale="value"
        @click="traceView.scale = value; commit()"
      >
        {{ t(`traceScale.${value}`) }}
      </button>
    </div>

    <div class="trace-row">
      <span class="trace-group-label">{{ t("traceWindow") }}</span>
      <button
        v-for="seconds in WINDOW_CHOICES"
        :key="seconds"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.window === seconds }"
        @click="traceView.window = seconds; commit()"
      >
        {{ t("traceWindowSeconds", { seconds }) }}
      </button>

      <span class="trace-group-label">{{ t("traceResolution") }}</span>
      <button
        v-for="id in RESOLUTIONS"
        :key="id"
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.resolution === id }"
        @click="setResolution(id)"
      >
        {{ t(`traceResolution.${id}`) }}
      </button>
    </div>

    <div class="trace-row">
      <span class="trace-group-label">{{ t("traceColormap") }}</span>
      <button
        v-for="id in COLORMAP_IDS"
        :key="id"
        type="button"
        class="metro-chip trace-swatch"
        :class="[`trace-swatch--${id}`, { 'is-active': traceView.colormap === id }]"
        :data-trace-colormap="id"
        @click="setColormap(id)"
      >
        {{ t(`colormap.${id}`) }}
      </button>
    </div>

    <div class="trace-row trace-row--sliders">
      <label class="trace-slider">
        <span class="slider-label">{{ t("traceFloor") }}</span>
        <input
          type="range"
          min="-120"
          max="-40"
          step="5"
          data-trace-floor
          :value="traceView.floorDb"
          @input="setFloor(Number(($event.target as HTMLInputElement).value))"
        />
        <output class="slider-output">{{ String(traceView.floorDb).replace("-", "−") }} dB</output>
      </label>

      <label class="trace-slider">
        <span class="slider-label">{{ t("traceCeiling") }}</span>
        <input
          type="range"
          min="-60"
          max="0"
          step="5"
          data-trace-ceiling
          :value="traceView.ceilingDb"
          @input="setCeiling(Number(($event.target as HTMLInputElement).value))"
        />
        <output class="slider-output">{{ String(traceView.ceilingDb).replace("-", "−") }} dB</output>
      </label>
    </div>

    <div class="trace-row">
      <span class="trace-group-label">{{ t("traceReference") }}</span>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': !traceView.followTuner && traceView.referenceMidi === null }"
        @click="clearReference"
      >
        {{ t("traceReferenceNone") }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.followTuner }"
        data-trace-follow
        @click="followTuner"
      >
        {{ t("traceFollowTuner") }}<template v-if="traceView.followTuner && reference.current">
          · {{ reference.current.label.en }}</template>
      </button>
      <button
        v-for="(name, index) in NOTE_NAMES"
        :key="name"
        type="button"
        class="metro-chip"
        :class="{
          'is-active': !traceView.followTuner && traceView.referenceMidi !== null && pitchClass() === index
        }"
        @click="setReference(index, octave())"
      >
        {{ name }}
      </button>
      <span class="trace-group-label">{{ t("traceOctave") }}</span>
      <button
        v-for="value in OCTAVES"
        :key="`oct-${value}`"
        type="button"
        class="metro-chip metro-chip--tight"
        :class="{
          'is-active': !traceView.followTuner && traceView.referenceMidi !== null && octave() === value
        }"
        @click="setReference(pitchClass(), value)"
      >
        {{ value }}
      </button>
      <button
        type="button"
        class="metro-chip"
        :class="{ 'is-active': traceView.showHarmonics }"
        @click="traceView.showHarmonics = !traceView.showHarmonics; commit()"
      >
        {{ t("traceHarmonics") }}
      </button>
    </div>
  </div>
</template>
