/**
 * Playing, as opposed to scheduling.
 *
 * The metronome and the ear trainer both know when every note happens
 * before the first one sounds. A player at a keyboard does not: notes
 * start when a finger lands and end when it lifts, so the look-ahead
 * scheduler has nothing to look ahead at. What this needs instead is a
 * register of what is currently down.
 *
 * The clock is injected and is still `AudioContext.currentTime` — a note
 * pressed now and a note scheduled by the metronome have to be on the same
 * time base or they will never line up.
 */

import { getTimbre, timbreSpecAt, DEFAULT_RING_SECONDS } from "../../../audio/timbre.js";
import { renderVoice } from "../../../audio/render.js";

import { midiToFrequency } from "../../../lib/music-theory.js";
import type { HeldVoice, VoicePlayer } from "../../../audio/voice.js";

export interface PerformerOptions {
  player: VoicePlayer;
  /**
   * Needed only to render a physical model into a buffer. A synthesised
   * voice is built straight into the graph and does not need one, so a
   * caller that plays only those can leave it out.
   */
  context?: BaseAudioContext;
  /** Audio-clock seconds. */
  now: () => number;
  timbreId?: string;
  tuning?: number;
  /**
   * How the instrument is sounded. `synth` is the physical model; `hybrid`
   * keeps the model and lays the recording's own attack over it, which is
   * where most of what a listener recognises an instrument by lives;
   * `samples` plays the recording and nothing else.
   */
  tier?: VoiceTier;
  /** Which recording represents this instrument, when one does. */
  sample?: string;
  /**
   * How a recorded note is found. Injected rather than imported: this
   * schedules sound, and fetching a bank from the network is somebody
   * else's job — which is also what makes the tiers testable without one.
   */
  takeSample?: (name: string, midi: number) => SampledNote | null;
}

/** A recorded note, and how far it has to be resampled to be this one. */
export interface SampledNote {
  buffer: AudioBuffer;
  offset: number;
}

export type VoiceTier = "synth" | "hybrid" | "samples";

/**
 * How much of a recording is used as an attack. Long enough to carry the
 * hammer, the pick or the stick; short enough that what follows is the
 * model rather than a second recording of the same note.
 */
export const ATTACK_SECONDS = 0.28;

export interface Performer {
  noteOn(midi: number, velocity?: number): void;
  /**
   * Hit something that has no pitch. Pieces sharing a choke group cut each
   * other off, which is the whole difference between a hi-hat and two
   * unrelated cymbals.
   *
   * The piece brings its own voice and its own pitch: a drum's fundamental
   * is a fact about that drum, and handing the performer a finished spec
   * would put the decision of how it is made back in the caller.
   */
  strike(timbreId: string, tone: number, velocity?: number, choke?: string): void;
  noteOff(midi: number): void;
  /** Every note currently down, for the view to light up. */
  sounding(): number[];
  allOff(): void;
  setTimbre(id: string): void;
  /** How the instrument is made: model, model plus recording, recording. */
  setTier(tier: VoiceTier): void;
  /** Which recording represents this instrument, when one does. */
  setSample(name: string | undefined): void;
  setTuning(hz: number): void;
  setVolume(value: number): void;
  dispose(): void;
}

export function createPerformer(options: PerformerOptions): Performer {
  const { player, now, context } = options;
  let tier: VoiceTier = options.tier ?? "synth";
  let sample = options.sample;
  const held = new Map<number, HeldVoice>();
  const choked = new Map<string, HeldVoice>();
  let timbre = getTimbre(options.timbreId ?? "singable");
  let tuning = options.tuning ?? 440;

  function stop(midi: number): void {
    held.get(midi)?.release(now());
    held.delete(midi);
  }

  /** A held note: the model's own samples if it has them, a voice if not. */
  function start(midi: number, velocity: number): HeldVoice {
    if (timbre.model && context) {
      const buffer = renderVoice(
        context,
        timbre.model,
        `${timbre.id}:${midi}`,
        midi,
        midiToFrequency(midi, tuning)
      );
      return player.playBuffer(buffer, now(), velocity, { release: timbre.release });
    }
    const spec = timbreSpecAt(timbre, midiToFrequency(midi, tuning), timbre.ring ?? DEFAULT_RING_SECONDS);
    return player.hold(spec, now(), velocity);
  }

  /**
   * The recording, when there is one and the tier wants it. Returns the
   * held voice for `samples` — where it is the whole note — and null for
   * every other case, having already laid the attack over a model note for
   * `hybrid`.
   */
  function recorded(midi: number, velocity: number): HeldVoice | null {
    if (tier === "synth" || !sample) return null;
    const take = options.takeSample?.(sample, midi) ?? null;
    if (!take) return null;
    const rate = Math.pow(2, take.offset / 12);

    if (tier === "hybrid") {
      // Layered over the model rather than instead of it: the recording
      // says what the instrument sounds like at the instant it is struck,
      // and the model says what it does afterwards.
      player.playBuffer(take.buffer, now(), velocity, {
        rate,
        seconds: ATTACK_SECONDS,
        release: 0.02
      });
      return null;
    }

    return player.playBuffer(take.buffer, now(), velocity, { rate, release: 0.12 });
  }

  return {
    noteOn(midi: number, velocity = 0.8) {
      // Retriggering a key that is already down restarts it rather than
      // stacking a second voice on the same pitch.
      stop(midi);
      const already = recorded(midi, velocity);
      held.set(midi, already ?? start(midi, velocity));
    },
    strike(timbreId: string, tone: number, velocity = 0.9, choke?: string) {
      const voice = getTimbre(timbreId);
      const startHit = (): HeldVoice => {
        const hitting = recorded(60, velocity);
        if (hitting) return hitting;
        if (voice.model && context) {
          const buffer = renderVoice(context, voice.model, `${voice.id}:${tone}`, 60, tone);
          return player.playBuffer(buffer, now(), velocity, { release: 0.05 });
        }
        return player.hold(
          timbreSpecAt(voice, tone, voice.ring ?? DEFAULT_RING_SECONDS),
          now(),
          velocity
        );
      };

      if (choke) {
        choked.get(choke)?.release(now());
        choked.set(choke, startHit());
        return;
      }
      startHit();
    },
    noteOff(midi: number) {
      stop(midi);
    },
    sounding() {
      return [...held.keys()].sort((a, b) => a - b);
    },
    allOff() {
      for (const midi of [...held.keys()]) stop(midi);
      for (const voice of choked.values()) voice.release(now());
      choked.clear();
    },
    setTimbre(id: string) {
      // Notes already down keep the timbre they started with; changing it
      // under a sounding note would be a click, not a change of colour.
      timbre = getTimbre(id);
      sample = options.sample;
    },
    setTier(next: VoiceTier) {
      // Likewise: a note already down keeps the voice it started with, so
      // changing how the instrument is made is never a click either.
      tier = next;
    },
    setSample(name: string | undefined) {
      sample = name;
    },
    setTuning(hz: number) {
      tuning = hz;
    },
    setVolume(value: number) {
      player.setVolume(value);
    },
    dispose() {
      this.allOff();
      player.dispose();
    }
  };
}
