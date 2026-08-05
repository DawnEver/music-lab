/**
 * Canvas rendering for the logarithmic spectrum. Every function takes its
 * rendering context explicitly (no module-level DOM references), so the
 * module can be imported outside the browser; only the drawing functions
 * themselves touch canvas/window APIs.
 */

import { clamp } from "./dsp.js";
import { frequencyToNote } from "./music-theory.js";

export const SPECTRUM_MIN_HZ = 40;
export const SPECTRUM_MAX_HZ = 12000;

export interface SpectrumTarget {
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
}

/** Size the canvas to the wrapper's device-pixel dimensions. */
export function resizeCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  const rect = wrap.getBoundingClientRect();
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function clearSpectrumCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  resizeCanvas(canvas, wrap);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpectrumGrid(ctx, canvas.width, canvas.height, null);
}

/** Map a frequency to an x position within the plot area on a log scale. */
export function frequencyToX(frequency: number, width: number, left: number, right: number, maxFrequency: number): number {
  const minLog = Math.log10(SPECTRUM_MIN_HZ);
  const maxLog = Math.log10(maxFrequency);
  const value = (Math.log10(frequency) - minLog) / (maxLog - minLog);
  return left + clamp(value, 0, 1) * (width - left - right);
}

/** Draw the log-frequency grid and dB reference lines. */
export function drawSpectrumGrid(ctx: CanvasRenderingContext2D, width: number, height: number, maxFrequency: number | null): void {
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const left = 52 * dpr;
  const right = 18 * dpr;
  const top = 18 * dpr;
  const bottom = 34 * dpr;
  const actualMax = maxFrequency || SPECTRUM_MAX_HZ;
  const plotHeight = height - top - bottom;

  ctx.save();
  ctx.lineWidth = 1 * dpr;
  ctx.font = `${9 * dpr}px ${getComputedStyle(document.documentElement).getPropertyValue("--font-mono")}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(148,163,184,0.56)";
  ctx.strokeStyle = "rgba(148,163,184,0.105)";

  const frequencies = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  for (const frequency of frequencies) {
    if (frequency >= actualMax) continue;
    const x = frequencyToX(frequency, width, left, right, actualMax);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotHeight);
    ctx.stroke();

    const label = frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, height - 15 * dpr);
  }

  const dbMarks = [-20, -40, -60, -80];
  for (const db of dbMarks) {
    const normalized = clamp((db + 100) / 90, 0, 1);
    const y = top + (1 - normalized) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(`${db}`, left - 8 * dpr, y);
  }

  ctx.restore();
}

export interface SpectrumDrawOptions extends SpectrumTarget {
  sampleRate: number;
  latestPitch: { frequency: number } | null;
  fftSize: number;
  tuning?: number;
}

/**
 * Render the spectrum curve, its peak marker, and the current pitch
 * marker. Takes the live analyser data plus a rendering context object.
 */
export function drawSpectrum(data: Float32Array, options: SpectrumDrawOptions): void {
  const { canvas, wrap, sampleRate, latestPitch, fftSize, tuning = 440 } = options;
  resizeCanvas(canvas, wrap);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const left = 52 * dpr;
  const right = 18 * dpr;
  const top = 18 * dpr;
  const bottom = 34 * dpr;
  const plotHeight = height - top - bottom;
  const srate = sampleRate || 48000;
  const maxFrequency = Math.min(SPECTRUM_MAX_HZ, srate / 2 - 1);
  const binHz = srate / fftSize;

  ctx.clearRect(0, 0, width, height);
  drawSpectrumGrid(ctx, width, height, maxFrequency);

  if (!data || !data.length) return;

  const pointCount = Math.max(260, Math.floor((width - left - right) / (2 * dpr)));
  const points: Array<{ x: number; y: number }> = [];
  let peakDb = -160;

  for (let i = 0; i < pointCount; i += 1) {
    const ratio = i / (pointCount - 1);
    const frequency = SPECTRUM_MIN_HZ * Math.pow(maxFrequency / SPECTRUM_MIN_HZ, ratio);
    const center = frequency / binHz;
    const lowerFrequency =
      i === 0
        ? frequency
        : SPECTRUM_MIN_HZ * Math.pow(maxFrequency / SPECTRUM_MIN_HZ, (i - 0.5) / (pointCount - 1));
    const upperFrequency =
      i === pointCount - 1
        ? frequency
        : SPECTRUM_MIN_HZ * Math.pow(maxFrequency / SPECTRUM_MIN_HZ, (i + 0.5) / (pointCount - 1));
    const start = Math.max(1, Math.floor(lowerFrequency / binHz));
    const end = Math.min(data.length - 2, Math.max(start, Math.ceil(upperFrequency / binHz)));
    let db = -160;

    if (end - start <= 1) {
      const index = clamp(Math.round(center), 1, data.length - 2);
      db = Number.isFinite(data[index]) ? data[index] : -160;
    } else {
      for (let bin = start; bin <= end; bin += 1) {
        const value = Number.isFinite(data[bin]) ? data[bin] : -160;
        if (value > db) db = value;
      }
    }

    peakDb = Math.max(peakDb, db);
    const normalized = clamp((db + 100) / 90, 0, 1);
    points.push({
      x: left + ratio * (width - left - right),
      y: top + (1 - normalized) * plotHeight
    });
  }

  if (peakDb < -130) return;

  const fillGradient = ctx.createLinearGradient(0, top, 0, top + plotHeight);
  fillGradient.addColorStop(0, "rgba(94,234,212,0.36)");
  fillGradient.addColorStop(0.45, "rgba(124,156,255,0.18)");
  fillGradient.addColorStop(1, "rgba(124,156,255,0.01)");

  const strokeGradient = ctx.createLinearGradient(left, 0, width - right, 0);
  strokeGradient.addColorStop(0, "#5eead4");
  strokeGradient.addColorStop(0.5, "#7c9cff");
  strokeGradient.addColorStop(1, "#c084fc");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, top + plotHeight);
  for (const point of points) ctx.lineTo(point.x, point.y);
  ctx.lineTo(points[points.length - 1].x, top + plotHeight);
  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineWidth = 1.65 * dpr;
  ctx.strokeStyle = strokeGradient;
  ctx.shadowColor = "rgba(124,156,255,0.34)";
  ctx.shadowBlur = 9 * dpr;
  ctx.stroke();
  ctx.restore();

  if (latestPitch && latestPitch.frequency <= maxFrequency) {
    const x = frequencyToX(latestPitch.frequency, width, left, right, maxFrequency);
    const note = frequencyToNote(latestPitch.frequency, tuning);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([4 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const label = `${note.name}${note.octave} · ${latestPitch.frequency.toFixed(1)} Hz`;
    ctx.font = `${10 * dpr}px ${getComputedStyle(document.documentElement).getPropertyValue("--font-mono")}`;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + 16 * dpr;
    const boxX = clamp(x - boxWidth / 2, left, width - right - boxWidth);
    const boxY = top + 8 * dpr;

    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, 24 * dpr, 7 * dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(248,250,252,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, boxX + boxWidth / 2, boxY + 12 * dpr);
    ctx.restore();
  }
}
