import {
  correlationForKey,
  estimateKey,
  type Key,
  type KeyEstimate
} from "./key.js";

/** Accumulates decaying chroma and stabilizes key changes with hysteresis. */
export class KeyTracker {
  private accum = new Float32Array(12);
  private lastPushAt: number | null = null;
  private current: Key | null = null;
  private challenger: Key | null = null;
  private challengerCount = 0;
  private readonly halfLifeMs = 6000;
  private readonly switchMargin = 0.04;
  private readonly switchVotes = 4;

  push(chroma: Float32Array | number[], now: number): void {
    if (this.lastPushAt !== null) {
      const decay = Math.pow(0.5, Math.max(0, now - this.lastPushAt) / this.halfLifeMs);
      for (let i = 0; i < 12; i += 1) this.accum[i] *= decay;
    }
    this.lastPushAt = now;
    for (let i = 0; i < 12; i += 1) this.accum[i] += Math.max(0, chroma[i]);
  }

  estimate(): KeyEstimate | null {
    const estimate = estimateKey(this.accum);
    if (!estimate || estimate.correlation < 0.35) {
      return this.current && estimate ? { ...estimate, key: this.current } : null;
    }
    if (!this.current) {
      this.current = estimate.key;
      this.clearChallenger();
      return estimate;
    }
    if (this.sameKey(estimate.key, this.current)) {
      this.clearChallenger();
      return estimate;
    }

    const continuesChallenge = !this.challenger || this.sameKey(estimate.key, this.challenger);
    if (continuesChallenge && estimate.correlation > correlationForKey(this.accum, this.current) + this.switchMargin) {
      this.challenger = estimate.key;
      this.challengerCount += 1;
      if (this.challengerCount >= this.switchVotes) {
        this.current = estimate.key;
        this.clearChallenger();
      }
    } else if (!continuesChallenge) {
      this.clearChallenger();
    }
    return { ...estimate, key: this.current };
  }

  reset(): void {
    this.accum.fill(0);
    this.lastPushAt = null;
    this.current = null;
    this.clearChallenger();
  }

  private sameKey(left: Key, right: Key): boolean {
    return left.tonic === right.tonic && left.mode === right.mode;
  }

  private clearChallenger(): void {
    this.challenger = null;
    this.challengerCount = 0;
  }
}
