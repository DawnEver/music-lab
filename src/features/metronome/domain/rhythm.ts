/**
 * The rhythm compiler: meter + accents + subdivision (+ swing, polyrhythm)
 * in, a sorted list of bar-relative events out.
 *
 * This is pure: it knows nothing about Web Audio or Vue. The scheduler
 * turns `time` into an absolute audio-clock time; the UI reads the same
 * events to draw the beat grid.
 */

import type { Accent } from "./accent.js";
import { meterPulses, type Meter } from "./meter.js";

export interface Subdivision {
  /** 1 = quarter, 2 = eighth, 3 = triplet, 4 = sixteenth, … */
  divisions: number;
  /** 0 = straight, 1 = full triplet swing. Ignored for odd divisions. */
  swing?: number;
}

export interface RhythmPattern {
  meter: Meter;
  accents: Accent[];
  subdivision: Subdivision;
  /** Even pulses per bar on a second voice (3 = 3-against-the-bar). */
  polyrhythm?: number;
}

export type Voice = "main" | "poly";

export interface BeatEvent {
  /** Seconds from the start of the bar. */
  time: number;
  /** Pulse index within the bar. */
  pulse: number;
  /** Subdivision index inside the pulse (0 = the pulse itself). */
  tick: number;
  accent: Accent;
  voice: Voice;
}

/**
 * Where subdivision `index` of `divisions` sits inside a pulse, as a
 * fraction. Swing delays the second note of every pair; at swing = 1 an
 * eighth pair becomes 2/3 + 1/3, i.e. a triplet feel.
 */
export function swingOffset(index: number, divisions: number, swing = 0): number {
  const straight = index / divisions;
  if (!swing || divisions % 2 !== 0 || index % 2 === 0) return straight;
  return (index + swing / 3) / divisions;
}

export function compileBar(pattern: RhythmPattern, pulseSeconds: number): BeatEvent[] {
  const { meter, accents, subdivision } = pattern;
  const pulses = meterPulses(meter);
  const divisions = Math.max(1, Math.round(subdivision.divisions));
  const swing = subdivision.swing ?? 0;
  const events: BeatEvent[] = [];

  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const accent = accents[pulse] ?? "weak";
    if (accent === "mute") continue;

    for (let tick = 0; tick < divisions; tick += 1) {
      events.push({
        time: (pulse + swingOffset(tick, divisions, swing)) * pulseSeconds,
        pulse,
        tick,
        accent: tick === 0 ? accent : "subdivision",
        voice: "main"
      });
    }
  }

  const poly = Math.max(0, Math.round(pattern.polyrhythm ?? 0));
  if (poly > 0) {
    const bar = pulses * pulseSeconds;
    for (let index = 0; index < poly; index += 1) {
      events.push({
        time: (index / poly) * bar,
        pulse: index,
        tick: 0,
        accent: index === 0 ? "medium" : "weak",
        voice: "poly"
      });
    }
  }

  return events.sort((a, b) => a.time - b.time || (a.voice === b.voice ? 0 : a.voice === "main" ? -1 : 1));
}
