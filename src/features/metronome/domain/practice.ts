/**
 * Practice mode: what the bar at index N should sound like.
 *
 * Pure and deterministic — randomness is injected — so "bar 7 is silent"
 * is a unit test rather than something you have to hear.
 */

export interface PracticeConfig {
  rampEnabled: boolean;
  /** Raise the tempo every this many bars. */
  rampEveryBars: number;
  rampBpm: number;
  rampMaxBpm: number;
  silentEnabled: boolean;
  playBars: number;
  silentBars: number;
  randomMuteEnabled: boolean;
  /** 0..1 chance that a whole bar drops out. */
  randomMuteChance: number;
}

export interface BarPlan {
  bpm: number;
  silent: boolean;
}

export function defaultPractice(): PracticeConfig {
  return {
    rampEnabled: false,
    rampEveryBars: 4,
    rampBpm: 5,
    rampMaxBpm: 180,
    silentEnabled: false,
    playBars: 4,
    silentBars: 4,
    randomMuteEnabled: false,
    randomMuteChance: 0.25
  };
}

export function practiceForBar(
  config: PracticeConfig,
  barIndex: number,
  baseBpm: number,
  random: () => number
): BarPlan {
  let bpm = baseBpm;

  if (config.rampEnabled && config.rampEveryBars > 0 && config.rampBpm !== 0) {
    const steps = Math.floor(barIndex / config.rampEveryBars);
    bpm = baseBpm + steps * config.rampBpm;
    bpm = config.rampBpm > 0 ? Math.min(bpm, config.rampMaxBpm) : Math.max(bpm, config.rampMaxBpm);
  }

  let silent = false;

  if (config.silentEnabled && config.playBars > 0 && config.silentBars > 0) {
    const cycle = config.playBars + config.silentBars;
    silent = barIndex % cycle >= config.playBars;
  }

  if (!silent && config.randomMuteEnabled) {
    silent = random() < config.randomMuteChance;
  }

  return { bpm: Math.round(bpm), silent };
}
