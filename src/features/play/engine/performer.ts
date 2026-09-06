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

import { getTimbre, timbreSpec, DEFAULT_RING_SECONDS } from "../../../audio/timbre.js";
import type { HeldVoice, VoicePlayer } from "../../../audio/voice.js";

export interface PerformerOptions {
  player: VoicePlayer;
  /** Audio-clock seconds. */
  now: () => number;
  timbreId?: string;
  tuning?: number;
}

export interface Performer {
  noteOn(midi: number, velocity?: number): void;
  noteOff(midi: number): void;
  /** Every note currently down, for the view to light up. */
  sounding(): number[];
  allOff(): void;
  setTimbre(id: string): void;
  setTuning(hz: number): void;
  setVolume(value: number): void;
  dispose(): void;
}

export function createPerformer(options: PerformerOptions): Performer {
  const { player, now } = options;
  const held = new Map<number, HeldVoice>();
  let timbre = getTimbre(options.timbreId ?? "singable");
  let tuning = options.tuning ?? 440;

  function stop(midi: number): void {
    held.get(midi)?.release(now());
    held.delete(midi);
  }

  return {
    noteOn(midi: number, velocity = 0.8) {
      // Retriggering a key that is already down restarts it rather than
      // stacking a second voice on the same pitch.
      stop(midi);
      const spec = timbreSpec(timbre, midi, timbre.ring ?? DEFAULT_RING_SECONDS, tuning);
      held.set(midi, player.hold(spec, now(), velocity));
    },
    noteOff(midi: number) {
      stop(midi);
    },
    sounding() {
      return [...held.keys()].sort((a, b) => a - b);
    },
    allOff() {
      for (const midi of [...held.keys()]) stop(midi);
    },
    setTimbre(id: string) {
      // Notes already down keep the timbre they started with; changing it
      // under a sounding note would be a click, not a change of colour.
      timbre = getTimbre(id);
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
