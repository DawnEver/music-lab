/**
 * The scope canvas: a time axis with layers on it.
 *
 * The heat map and the pitch line are two readings of one history — energy
 * per band, and the fundamental — so they share the buffer, the time axis
 * and the frequency scale, and differ only in what they draw. The layer
 * you want depends on what you are listening to: an instrument's partials
 * need the heat map, a voice reads far better as a single line.
 */

import { frequencyToNote, midiToFrequency } from "../music-theory.js";
import { pitchSegments } from "../pitch-track.js";
import type { SpectrogramColumn } from "../spectrogram.js";
import { spectrogramImage } from "./spectrogram-image.js";
import { frequencyTicks, semitoneTicks, type Scale, type Tick } from "./scale.js";
import { plotFont, plotPalette, type PlotPalette } from "./palette.js";
import { plotBox, resizeCanvas, unitToX, unitToY, type PlotBox, type PlotInsets } from "./canvas.js";

const INSETS: PlotInsets = { left: 46, right: 62, top: 12, bottom: 26 };
/** Width of the colour bar, in CSS pixels, inside the right gutter. */
const COLORBAR_WIDTH = 12;

export interface ReferenceLine {
  hz: number;
  label: string;
  kind: "reference" | "harmonic";
}

export interface ScopeDrawOptions {
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
  columns: readonly SpectrogramColumn[];
  startTime: number;
  endTime: number;
  frequency: Scale;
  /** Note-name ticks instead of Hz. */
  semitoneAxis: boolean;
  bandCentres: Float32Array;
  floorDb: number;
  ceilingDb: number;
  lut: Uint8ClampedArray;
  showSpectrogram: boolean;
  showPitch: boolean;
  references: ReferenceLine[];
  /** Playhead time when frozen; null follows the live edge. */
  playheadTime: number | null;
  tuning: number;
}

export function drawScope(options: ScopeDrawOptions): void {
  const { canvas, wrap } = options;
  resizeCanvas(canvas, wrap);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const area = plotBox(canvas.width, canvas.height, INSETS);
  const palette = plotPalette();
  ctx.clearRect(0, 0, area.canvasWidth, area.canvasHeight);

  if (options.showSpectrogram) {
    drawHeatmap(ctx, area, options);
  }
  drawGrid(ctx, area, options, palette);
  drawReferences(ctx, area, options, palette);
  if (options.showPitch) drawPitchLine(ctx, area, options, palette);
  drawPlayhead(ctx, area, options, palette);
  drawColorbar(ctx, area, options, palette);
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions
): void {
  const width = Math.max(1, Math.round(area.width));
  const height = Math.max(1, Math.round(area.height));
  const image = spectrogramImage(options.columns, {
    width,
    height,
    startTime: options.startTime,
    endTime: options.endTime,
    frequency: options.frequency,
    bandCentres: options.bandCentres,
    floorDb: options.floorDb,
    ceilingDb: options.ceilingDb,
    lut: options.lut
  });
  ctx.putImageData(new ImageData(image.data, width, height), area.left, area.top);
}

function axisTicks(options: ScopeDrawOptions): Tick[] {
  return options.semitoneAxis
    ? semitoneTicks(options.frequency, options.tuning)
    : frequencyTicks(options.frequency);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions,
  palette: PlotPalette
): void {
  const dpr = area.dpr;
  ctx.save();
  ctx.lineWidth = dpr;
  ctx.font = plotFont(9 * dpr);
  ctx.textBaseline = "middle";
  ctx.strokeStyle = palette.grid;
  ctx.fillStyle = palette.axis;

  for (const tick of axisTicks(options)) {
    const y = unitToY(area, tick.position);
    ctx.globalAlpha = tick.accidental ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(tick.label, area.left - 6 * dpr, y);
  }
  ctx.globalAlpha = 1;

  // Time axis: one label per second-ish, counting back from the right edge.
  const span = options.endTime - options.startTime;
  const step = span <= 3 ? 0.5 : span <= 12 ? 2 : 5;
  ctx.textAlign = "center";
  for (let back = 0; back <= span + 1e-6; back += step) {
    const unit = 1 - back / span;
    if (unit < 0) break;
    const x = unitToX(area, unit);
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.top + area.height);
    ctx.stroke();
    ctx.fillText(back === 0 ? "0" : `-${trim(back)}s`, x, area.canvasHeight - 12 * dpr);
  }
  ctx.restore();
}

function trim(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function drawReferences(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions,
  palette: PlotPalette
): void {
  if (!options.references.length) return;
  const dpr = area.dpr;
  ctx.save();
  ctx.font = plotFont(10 * dpr);
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";

  for (const line of options.references) {
    const unit = options.frequency.position(line.hz);
    if (unit <= 0 || unit >= 1) continue;
    const y = unitToY(area, unit);
    ctx.strokeStyle = line.kind === "reference" ? palette.reference : palette.harmonic;
    ctx.lineWidth = (line.kind === "reference" ? 1.6 : 1) * dpr;
    ctx.setLineDash(line.kind === "reference" ? [] : [3 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
    if (line.kind === "reference") {
      ctx.fillStyle = palette.reference;
      ctx.fillText(line.label, area.left + 6 * dpr, y - 3 * dpr);
    }
  }
  ctx.restore();
}

function drawPitchLine(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions,
  palette: PlotPalette
): void {
  const span = Math.max(options.endTime - options.startTime, 1e-6);
  const dpr = area.dpr;
  ctx.save();
  ctx.lineWidth = 2 * dpr;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = palette.track;
  ctx.shadowColor = palette.trackGlow;
  ctx.shadowBlur = 6 * dpr;

  // One path per voiced run: joining across a breath would draw a
  // glissando the player never made.
  for (const segment of pitchSegments(options.columns)) {
    ctx.beginPath();
    segment.forEach((column, index) => {
      const x = unitToX(area, (column.time - options.startTime) / span);
      const y = unitToY(area, options.frequency.position(column.pitchHz as number));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions,
  palette: PlotPalette
): void {
  if (options.playheadTime === null) return;
  const span = Math.max(options.endTime - options.startTime, 1e-6);
  const unit = (options.playheadTime - options.startTime) / span;
  if (unit < 0 || unit > 1) return;
  const x = unitToX(area, unit);
  ctx.save();
  ctx.strokeStyle = palette.marker;
  ctx.lineWidth = 1.5 * area.dpr;
  ctx.beginPath();
  ctx.moveTo(x, area.top);
  ctx.lineTo(x, area.top + area.height);
  ctx.stroke();
  ctx.restore();
}

/** The colour ramp as a dB axis — without it the colours mean nothing. */
function drawColorbar(
  ctx: CanvasRenderingContext2D,
  area: PlotBox,
  options: ScopeDrawOptions,
  palette: PlotPalette
): void {
  if (!options.showSpectrogram) return;
  const dpr = area.dpr;
  const width = COLORBAR_WIDTH * dpr;
  const x = area.left + area.width + 10 * dpr;
  const steps = options.lut.length / 4;

  ctx.save();
  for (let i = 0; i < steps; i += 1) {
    const unit = i / (steps - 1);
    const y = unitToY(area, unit);
    const entry = i * 4;
    ctx.fillStyle = `rgb(${options.lut[entry]},${options.lut[entry + 1]},${options.lut[entry + 2]})`;
    ctx.fillRect(x, y, width, Math.ceil(area.height / steps) + 1);
  }

  ctx.strokeStyle = palette.chipBorder;
  ctx.lineWidth = dpr;
  ctx.strokeRect(x, area.top, width, area.height);

  ctx.fillStyle = palette.axis;
  ctx.font = plotFont(9 * dpr);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${options.ceilingDb}`, x + width + 4 * dpr, area.top + 4 * dpr);
  ctx.fillText(`${options.floorDb}`, x + width + 4 * dpr, area.top + area.height - 4 * dpr);
  ctx.restore();
}

/** Label for a reference line, e.g. "A4 · 440.0 Hz". */
export function referenceLabel(midi: number, tuning: number): string {
  const hz = midiToFrequency(midi, tuning);
  const note = frequencyToNote(hz, tuning);
  return `${note.name}${note.octave} · ${hz.toFixed(1)} Hz`;
}
