/**
 * The instant spectrum: one frame of energy against log frequency.
 *
 * It is one projection of the analysis stream — the spectrogram and the
 * pitch track are others — so it owns no mapping and no colours of its own:
 * the frequency axis comes from a Scale and the palette from CSS tokens.
 */

import { frequencyToNote } from "../music-theory.js";
import { dbScale, frequencyTicks, logFrequencyScale, tickBudget, type Scale } from "./scale.js";
import { plotFont, plotPalette, type PlotPalette } from "./palette.js";
import {
  plotBox,
  resizeCanvas,
  unitToX,
  unitToY,
  type PlotBox,
  type PlotInsets
} from "./canvas.js";

export const SPECTRUM_MIN_HZ = 40;
export const SPECTRUM_MAX_HZ = 12000;
/** Curve height range; also the grid's dB labels. */
export const SPECTRUM_FLOOR_DB = -100;
export const SPECTRUM_CEILING_DB = -10;

const INSETS: PlotInsets = { left: 52, right: 18, top: 18, bottom: 34 };
const DB_LABELS = [-20, -40, -60, -80];

export interface SpectrumTarget {
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
}

export interface SpectrumDrawOptions extends SpectrumTarget {
  sampleRate: number;
  latestPitch: { frequency: number } | null;
  fftSize: number;
  tuning?: number;
}

function box(canvas: HTMLCanvasElement): PlotBox {
  return plotBox(canvas.width, canvas.height, INSETS);
}

/** Highest frequency this stream can show. */
function ceilingHz(sampleRate: number): number {
  return Math.min(SPECTRUM_MAX_HZ, (sampleRate || 48000) / 2 - 1);
}

export function clearSpectrumCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  resizeCanvas(canvas, wrap);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpectrumGrid(ctx, box(canvas), logFrequencyScale(SPECTRUM_MIN_HZ, SPECTRUM_MAX_HZ));
}

/** Log-frequency gridlines plus the dB reference lines. */
export function drawSpectrumGrid(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  frequency: Scale,
  palette: PlotPalette = plotPalette()
): void {
  const level = dbScale(SPECTRUM_FLOOR_DB, SPECTRUM_CEILING_DB);
  ctx.save();
  ctx.fillStyle = palette.surface;
  ctx.fillRect(area.left, area.top, area.width, area.height);

  ctx.lineWidth = area.dpr;
  ctx.font = plotFont(9 * area.dpr);
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.axis;
  ctx.strokeStyle = palette.grid;

  for (const tick of frequencyTicks(frequency, { maxTicks: tickBudget(area.width, 46 * area.dpr) })) {
    const x = unitToX(area, tick.position);
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.top + area.height);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(tick.label, x, area.canvasHeight - 15 * area.dpr);
  }

  for (const db of DB_LABELS) {
    const y = unitToY(area, level.position(db));
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(`${db}`, area.left - 8 * area.dpr, y);
  }
  ctx.restore();
}

/** Render the curve, and mark the currently detected pitch. */
export function drawSpectrum(data: Float32Array, options: SpectrumDrawOptions): void {
  const { canvas, wrap, sampleRate, latestPitch, fftSize, tuning = 440 } = options;
  resizeCanvas(canvas, wrap);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const area = box(canvas);
  const maxFrequency = ceilingHz(sampleRate);
  const frequency = logFrequencyScale(SPECTRUM_MIN_HZ, maxFrequency);
  const level = dbScale(SPECTRUM_FLOOR_DB, SPECTRUM_CEILING_DB);
  const palette = plotPalette();

  ctx.clearRect(0, 0, area.canvasWidth, area.canvasHeight);
  drawSpectrumGrid(ctx, area, frequency, palette);
  if (!data || !data.length) return;

  const binHz = (sampleRate || 48000) / fftSize;
  const pointCount = Math.max(260, Math.floor(area.width / (2 * area.dpr)));
  const points: Array<{ x: number; y: number }> = [];
  let peakDb = -160;

  for (let i = 0; i < pointCount; i += 1) {
    const ratio = i / (pointCount - 1);
    const centre = frequency.invert(ratio);
    const lower = frequency.invert(Math.max(0, ratio - 0.5 / (pointCount - 1)));
    const upper = frequency.invert(Math.min(1, ratio + 0.5 / (pointCount - 1)));
    const start = Math.max(1, Math.floor(lower / binHz));
    const end = Math.min(data.length - 2, Math.max(start, Math.ceil(upper / binHz)));
    let db = -160;

    if (end - start <= 1) {
      const index = Math.max(1, Math.min(data.length - 2, Math.round(centre / binHz)));
      db = Number.isFinite(data[index]) ? data[index] : -160;
    } else {
      for (let bin = start; bin <= end; bin += 1) {
        const value = Number.isFinite(data[bin]) ? data[bin] : -160;
        if (value > db) db = value;
      }
    }

    peakDb = Math.max(peakDb, db);
    points.push({ x: unitToX(area, ratio), y: unitToY(area, level.position(db)) });
  }

  if (peakDb < -130) return;

  const baseline = area.top + area.height;
  const fillGradient = ctx.createLinearGradient(0, area.top, 0, baseline);
  fillGradient.addColorStop(0, palette.fill1);
  fillGradient.addColorStop(0.45, palette.fill2);
  fillGradient.addColorStop(1, palette.fill3);

  const strokeGradient = ctx.createLinearGradient(area.left, 0, area.left + area.width, 0);
  strokeGradient.addColorStop(0, palette.stroke1);
  strokeGradient.addColorStop(0.5, palette.stroke2);
  strokeGradient.addColorStop(1, palette.stroke3);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, baseline);
  for (const point of points) ctx.lineTo(point.x, point.y);
  ctx.lineTo(points[points.length - 1].x, baseline);
  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineWidth = 1.65 * area.dpr;
  ctx.strokeStyle = strokeGradient;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 9 * area.dpr;
  ctx.stroke();
  ctx.restore();

  if (latestPitch && latestPitch.frequency <= maxFrequency) {
    drawPitchMarker(ctx, area, frequency, palette, latestPitch.frequency, tuning);
  }
}

function drawPitchMarker(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  frequency: Scale,
  palette: PlotPalette,
  hz: number,
  tuning: number
): void {
  const dpr = area.dpr;
  const x = unitToX(area, frequency.position(hz));
  const note = frequencyToNote(hz, tuning);
  const label = `${note.name}${note.octave} · ${hz.toFixed(1)} Hz`;

  ctx.save();
  ctx.font = plotFont(10 * dpr);
  const boxWidth = ctx.measureText(label).width + 16 * dpr;
  const boxX = Math.min(
    Math.max(x - boxWidth / 2, area.left),
    area.left + area.width - boxWidth
  );
  const boxY = area.top + 8 * dpr;

  // The dashed marker restarts below the chip so it never crosses the label.
  ctx.strokeStyle = palette.marker;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(x, area.top);
  ctx.lineTo(x, boxY);
  ctx.stroke();
  ctx.setLineDash([4 * dpr, 5 * dpr]);
  ctx.beginPath();
  ctx.moveTo(x, boxY + 28 * dpr);
  ctx.lineTo(x, area.top + area.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = palette.chipBg;
  ctx.strokeStyle = palette.chipBorder;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, 24 * dpr, 7 * dpr);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.chipText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, boxX + boxWidth / 2, boxY + 12 * dpr);
  ctx.restore();
}
