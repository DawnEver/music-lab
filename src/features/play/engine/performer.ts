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
  /** The same, for a piece of the kit, which has a file rather than a pitch. */
  takePercussion?: (name: string) => SampledNote | null;
}

/**
 * A recorded note: the samples, how far they have to be resampled to be
 * this note, and what they have to be multiplied by to sit at the level a
 * model of the same instrument sits at.
 *
 * Written out here rather than imported from the module that fetches
 * banks, because this schedules sound and that one goes to the network.
 * The two agree structurally, which is all either of them needs.
 */
export interface SampledNote {
  buffer: AudioBuffer;
  offset: number;
  gain: number;
  /**
   * Seconds of the tail that may be looped while the key is held, or 0 for
   * a recording that is played once and ends. A wind instrument does not
   * stop because a file did.
   */
  loop: number;
}

export type VoiceTier = "synth" | "hybrid" | "samples";

/**
 * How much of a recording is used as an attack.
 *
 * Short on purpose. A recording and a model of the same instrument are
 * two different instruments at the level of detail the ear uses, and the
 * longer they overlap the more the seam between them is audible — a
 * recorded attack fading into a synthesised sustain is heard as exactly
 * that unless the handover happens inside the transient, before either
 * has settled into a tone. The hammer, the pick and the stick all live in
 * the first tenth of a second.
 */
export const ATTACK_SECONDS = 0.12;

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
  strike(pieceId: string, timbreId: string, tone: number, velocity?: number, choke?: string): void;
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

  /**
   * A held note: the model's own samples if it has them, a voice if not.
   *
   * `fadeIn` is for a model played *under* a recording's attack. Both
   * start at the same instant when the two are layered, so a model that
   * came up at full level would be a second strike a few milliseconds
   * after the first — the seam the hybrid tier exists to avoid. Coming up
   * over the length of that attack puts the handover inside the transient
   * where the ear cannot find it.
   */
  function start(midi: number, velocity: number, fadeIn = 0): HeldVoice {
    if (timbre.model && context) {
      const buffer = renderVoice(
        context,
        timbre.model,
        `${timbre.id}:${midi}`,
        midi,
        midiToFrequency(midi, tuning)
      );
      return player.playBuffer(buffer, now(), velocity, {
        release: timbre.release,
        attack: fadeIn || undefined
      });
    }
    const spec = timbreSpecAt(timbre, midiToFrequency(midi, tuning), timbre.ring ?? DEFAULT_RING_SECONDS);
    return player.hold(fadeIn ? { ...spec, attack: fadeIn } : spec, now(), velocity);
  }

  /**
   * The recording, when there is one and the tier wants it.
   *
   * `voice` is the whole note, which is what the sampled tier is. `under`
   * is the other half of a crossfade: the recording has been started as an
   * attack, and the model has to come up beneath it rather than beside it.
   * Null is no recording at all — the model plays alone, which is what
   * every instrument without a bank has.
   */
  type Contribution = { voice: HeldVoice } | { under: true } | null;

  function recorded(midi: number, velocity: number): Contribution {
    if (tier === "synth" || !sample) return null;
    const take = options.takeSample?.(sample, midi) ?? null;
    if (!take) return null;
    /*
     * `offset` is where the recording sits *relative to the note asked
     * for*, so a recording two semitones up has to be played two semitones
     * slower. The sign is the whole of it: read the other way a note whose
     * bank entry is missing comes out twice as far from the note as the
     * bank's nearest entry was, which for a contrabass asked for a C5 is
     * an octave and a half below it. Nothing reveals this while a bank has
     * every note, because then the offset is zero and the exponent is one.
     */
    const rate = Math.pow(2, -take.offset / 12);

    if (tier === "hybrid") {
      // The recording says what the instrument sounds like at the instant
      // it is struck, and the model says what it does afterwards — so the
      // recording takes the attack and hands the note over inside it.
      player.playBuffer(take.buffer, now(), velocity, {
        rate,
        gain: take.gain,
        seconds: ATTACK_SECONDS,
        release: 0.02
      });
      return { under: true };
    }

    return {
      voice: player.playBuffer(take.buffer, now(), velocity, {
        rate,
        gain: take.gain,
        release: 0.12,
        // A key held longer than the recording is a note that has to keep
        // going: a wind instrument does not stop because a file did.
        loop: take.loop
      })
    };
  }

  return {
    noteOn(midi: number, velocity = 0.8) {
      // Retriggering a key that is already down restarts it rather than
      // stacking a second voice on the same pitch.
      stop(midi);
      const take = recorded(midi, velocity);
      if (take && "voice" in take) {
        held.set(midi, take.voice);
        return;
      }
      held.set(midi, start(midi, velocity, take ? ATTACK_SECONDS : 0));
    },
    strike(pieceId: string, timbreId: string, tone: number, velocity = 0.9, choke?: string) {
      const voice = getTimbre(timbreId);

      /**
       * The kit's own recording. A drum has no pitch to resample to, so
       * this is the one path that plays a buffer exactly as recorded.
       */
      const recordedHit = (): Contribution => {
        if (tier === "synth") return null;
        const take = options.takePercussion?.(pieceId) ?? null;
        if (!take) return null;
        if (tier === "hybrid") {
          // The same crossfade a pitched note gets: a stick hitting a drum
          // is over in the recording's attack, and a model that started
          // underneath it at full level would be a second hit.
          player.playBuffer(take.buffer, now(), velocity, {
            gain: take.gain,
            seconds: ATTACK_SECONDS,
            release: 0.02
          });
          return { under: true };
        }
        return {
          voice: player.playBuffer(take.buffer, now(), velocity, {
            gain: take.gain,
            release: 0.05
          })
        };
      };

      const startHit = (): HeldVoice => {
        const hit = recordedHit();
        if (hit && "voice" in hit) return hit.voice;
        const fadeIn = hit ? ATTACK_SECONDS : 0;
        if (voice.model && context) {
          const buffer = renderVoice(context, voice.model, `${voice.id}:${tone}`, 60, tone);
          return player.playBuffer(buffer, now(), velocity, {
            release: 0.05,
            attack: fadeIn || undefined
          });
        }
        const spec = timbreSpecAt(voice, tone, voice.ring ?? DEFAULT_RING_SECONDS);
        return player.hold(fadeIn ? { ...spec, attack: fadeIn } : spec, now(), velocity);
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
