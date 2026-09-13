<script setup lang="ts">
/**
 * Setup: which instrument, how it is strung, how loud.
 *
 * Chips rather than a dropdown, for two reasons: every option stays
 * visible, and a menu overlay teleports out of the sheet — so clicking one
 * reads as clicking outside and closes the sheet under the pointer.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import {
  instrumentCategories,
  instrumentsByCategory,
  isTuned,
  playableInstruments
} from "../../../instruments/index.js";
import { MAX_WHITE_MM, MIN_WHITE_MM } from "../domain/layout.js";
import {
  instrument,
  preset,
  setInstrument,
  setPreset,
  setVoiceTier,
  setVolume,
  setWhiteMm,
  settings,
  VOICE_TIERS
} from "../stores/play.js";
import { DRUMKIT_CREDIT, SOUNDFONT_CREDIT } from "../../../audio/soundfont.js";

const props = defineProps<{
  /**
   * The width the keyboard chose for itself, in millimetres, or null when
   * there is nothing on screen to measure — another instrument entirely.
   */
  autoWidthMm: number | null;
}>();

const { t, lang } = useI18n();

// Grouped by category: a flat list of every playable instrument stops
// being scannable the moment the fretted ones arrive.
const groups = computed(() =>
  instrumentCategories
    .map((category) => ({
      category,
      title: t(`instrument.category.${category}`),
      items: instrumentsByCategory(category, playableInstruments)
    }))
    .filter((group) => group.items.length > 0)
);

/** A kit's recordings are its own set; a bank has no percussion at all. */
const isKit = computed(() => instrument.value.surface.kind === "pads");

/** Only a keyboard has a white key to size, so only a keyboard offers one. */
const isKeys = computed(() => instrument.value.surface.kind === "keys");

/**
 * What the slider shows: the player's width, or the one the keyboard
 * arrived at by itself.
 *
 * A slider parked at a number it is not currently using is the ambiguous
 * control the whole app avoids — so while `自适应` is on it sits at the
 * real width, and the first drag takes over from there without a jump.
 */
const shownMm = computed(() => settings.whiteMm ?? props.autoWidthMm ?? MIN_WHITE_MM);

/** One of three, so it is a radio group rather than three switches. */
function onTierKey(event: KeyboardEvent, index: number): void {
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
    : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
    : 0;
  if (step === 0) return;
  event.preventDefault();
  setVoiceTier(VOICE_TIERS[(index + step + VOICE_TIERS.length) % VOICE_TIERS.length]);
}

const presets = computed(() => {
  const current = instrument.value;
  return isTuned(current) ? current.tuning.presets : [];
});
</script>

<template>
  <div class="control-group">
    <div v-for="group in groups" :key="group.category" class="metro-field">
      <span class="slider-label">{{ group.title }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in group.items"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': settings.instrumentId === entry.id }"
          :data-instrument="entry.id"
          @click="setInstrument(entry.id)"
        >
          {{ entry.name[lang] }}
        </button>
      </div>
    </div>

    <div v-if="presets.length > 1" class="metro-field">
      <span class="slider-label">{{ t("playTuning") }}</span>
      <div class="metro-chips">
        <button
          v-for="entry in presets"
          :key="entry.id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': preset?.id === entry.id }"
          :data-preset="entry.id"
          @click="setPreset(entry.id)"
        >
          {{ entry.name[lang] }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("playVoice") }}</span>
      <div class="metro-chips" role="radiogroup" :aria-label="t('playVoice')">
        <button
          v-for="(tier, index) in VOICE_TIERS"
          :key="tier"
          type="button"
          role="radio"
          class="metro-chip"
          :class="{ 'is-active': settings.voiceTier === tier }"
          :data-tier="tier"
          :aria-checked="settings.voiceTier === tier"
          :tabindex="settings.voiceTier === tier ? 0 : -1"
          @click="setVoiceTier(tier)"
          @keydown="onTierKey($event, index)"
        >
          {{ t(`playVoice_${tier}`) }}
        </button>
      </div>
    </div>

    <!--
      A key has a size, and both ends of it come from the hand — a real
      piano's white key and a fingertip. The room picks somewhere between
      them, which is right until the player wants a different one; then it
      is their number and it stops following the window. `自适应` is the way
      back, and it is a real switch rather than a third width.
    -->
    <div v-if="isKeys" class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("playKeyWidth") }}</span>
        <output class="slider-output" data-key-width>
          {{ settings.whiteMm === null && props.autoWidthMm === null
            ? t("playKeyWidthAuto")
            : `${shownMm.toFixed(1)}mm` }}
        </output>
      </div>
      <v-slider
        :min="MIN_WHITE_MM"
        :max="MAX_WHITE_MM"
        :step="0.5"
        :model-value="shownMm"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setWhiteMm(value)"
      />
      <div class="metro-chips">
        <button
          type="button"
          class="metro-chip"
          data-key-width-auto
          :class="{ 'is-active': settings.whiteMm === null }"
          :aria-pressed="settings.whiteMm === null"
          @click="setWhiteMm(null)"
        >
          {{ t("playKeyWidthAuto") }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("playVolume") }}</span>
        <output class="slider-output">{{ Math.round(settings.volume * 100) }}%</output>
      </div>
      <v-slider
        :min="0"
        :max="100"
        :step="1"
        :model-value="Math.round(settings.volume * 100)"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setVolume(value / 100)"
      />
    </div>

    <!-- The recordings are somebody else's work under a licence that
         asks to be named. It is said here rather than in the colophon
         because it is about one control on this panel, and a footer line
         is a line on every page. -->
    <p v-if="settings.voiceTier !== 'synth'" class="tier-credit">
      {{ t("playVoiceCredit", { name: isKit ? DRUMKIT_CREDIT.name : SOUNDFONT_CREDIT.name }) }}
      <a
        :href="isKit ? DRUMKIT_CREDIT.url : SOUNDFONT_CREDIT.url"
        rel="noreferrer"
        target="_blank"
        >{{ t("playVoiceCreditLink") }}</a
      >
    </p>
  </div>
</template>
