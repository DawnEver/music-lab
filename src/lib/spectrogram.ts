/**
 * Spectrogram data: log-frequency band reduction and the rolling history.
 *
 * The renderer never scrolls the canvas by one pixel per frame — that would
 * tie the time axis to the frame rate and make freezing, re-scaling and
 * replay impossible. Instead history is kept here as columns stamped with
 * audio time, and a view is a *query* over it (`window`), so the time window
 * is a zoom rather than a different recording.
 */

/** Values below this read as silence; also the substitute for non-finite bins. */
export const FLOOR_DB = -160;

/** Bands per column. Independent of canvas height — the renderer resamples. */
export const SPECTROGRAM_BANDS = 256;

export interface BandOptions {
  sampleRate: number;
  fftSize: number;
  minHz: number;
  maxHz: number;
  bands: number;
}

/** Geometric centre frequency of every band. */
export function bandFrequencies(options: BandOptions): Float32Array {
  const { minHz, maxHz, bands } = options;
  const ratio = maxHz / minHz;
  const centres = new Float32Array(bands);
  for (let i = 0; i < bands; i += 1) {
    centres[i] = minHz * Math.pow(ratio, i / (bands - 1));
  }
  return centres;
}

/**
 * Reduce an FFT magnitude frame to log-spaced bands, taking the **peak**
 * within each band rather than the mean: a band at 9 kHz covers dozens of
 * bins, and averaging would erase exactly the partials we draw this for.
 */
export function reduceToLogBands(
  data: ArrayLike<number>,
  options: BandOptions,
  out?: Float32Array
): Float32Array {
  const { sampleRate, fftSize, minHz, maxHz, bands } = options;
  const result = out && out.length === bands ? out : new Float32Array(bands);
  const binHz = sampleRate / fftSize;
  const ratio = maxHz / minHz;
  const lastBin = data.length - 1;

  for (let i = 0; i < bands; i += 1) {
    const centre = minHz * Math.pow(ratio, i / (bands - 1));
    const lower = minHz * Math.pow(ratio, (i - 0.5) / (bands - 1));
    const upper = minHz * Math.pow(ratio, (i + 0.5) / (bands - 1));
    const start = Math.max(0, Math.floor(lower / binHz));
    const end = Math.min(lastBin, Math.ceil(upper / binHz));

    let db = FLOOR_DB;
    if (end - start < 1) {
      const index = Math.max(0, Math.min(lastBin, Math.round(centre / binHz)));
      const value = data[index];
      db = Number.isFinite(value) ? value : FLOOR_DB;
    } else {
      for (let bin = start; bin <= end; bin += 1) {
        const value = data[bin];
        if (Number.isFinite(value) && value > db) db = value;
      }
    }
    result[i] = db;
  }
  return result;
}

export interface SpectrogramColumn {
  /** Audio-context time in seconds — the app's single time base. */
  time: number;
  db: Float32Array;
  /** Detected fundamental for this column, or null when unvoiced. */
  pitchHz: number | null;
}

/** A window copied out of the buffer, rebased to start at t = 0. */
export interface SpectrogramTake {
  columns: SpectrogramColumn[];
  duration: number;
}

/**
 * Fixed-capacity ring of columns. Capacity is a column count, so callers
 * size it from the retention they want and the capture rate they run at.
 */
export class SpectrogramBuffer {
  private readonly entries: (SpectrogramColumn | null)[];
  private next = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    this.entries = new Array<SpectrogramColumn | null>(Math.max(1, capacity)).fill(null);
  }

  static forDuration(seconds: number, capturesPerSecond: number): SpectrogramBuffer {
    return new SpectrogramBuffer(Math.max(1, Math.ceil(seconds * capturesPerSecond)));
  }

  get size(): number {
    return this.count;
  }

  push(column: SpectrogramColumn): void {
    this.entries[this.next] = column;
    this.next = (this.next + 1) % this.entries.length;
    this.count = Math.min(this.count + 1, this.entries.length);
  }

  clear(): void {
    this.entries.fill(null);
    this.next = 0;
    this.count = 0;
  }

  /** Every retained column, oldest first. */
  columns(): SpectrogramColumn[] {
    const result: SpectrogramColumn[] = [];
    const start = (this.next - this.count + this.entries.length) % this.entries.length;
    for (let i = 0; i < this.count; i += 1) {
      const entry = this.entries[(start + i) % this.entries.length];
      if (entry) result.push(entry);
    }
    return result;
  }

  /** Oldest and newest retained times, or null when empty. */
  span(): { start: number; end: number } | null {
    if (!this.count) return null;
    const all = this.columns();
    return { start: all[0].time, end: all[all.length - 1].time };
  }

  /**
   * Columns in `[endTime - seconds, endTime]`. `endTime` may be in the past,
   * which is what lets a frozen view scrub back through history.
   */
  window(endTime: number, seconds: number): SpectrogramColumn[] {
    const start = endTime - seconds;
    return this.columns().filter((column) => column.time >= start && column.time <= endTime);
  }

  /**
   * Copy a window out, rebased to t = 0 and detached from the ring, so a
   * recorded take survives the live capture overwriting its columns.
   */
  take(endTime: number, seconds: number): SpectrogramTake {
    const columns = this.window(endTime, seconds);
    const origin = columns.length ? columns[0].time : 0;
    return {
      duration: seconds,
      columns: columns.map((column) => ({
        time: column.time - origin,
        db: column.db.slice(),
        pitchHz: column.pitchHz
      }))
    };
  }
}
