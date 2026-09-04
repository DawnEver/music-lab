/**
 * Canvas geometry shared by every plot: device-pixel sizing and the plot
 * box (the area inside the axis gutters). Renderers work in unit space
 * (0..1 from a Scale) and convert here, so no renderer owns a mapping.
 */

import { clamp } from "../dsp-core.js";

export interface PlotInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PlotBox extends PlotInsets {
  /** Full canvas size in device pixels. */
  canvasWidth: number;
  canvasHeight: number;
  /** Plot area in device pixels. */
  width: number;
  height: number;
  dpr: number;
}

/** Capped at 2: a 3x buffer costs fill rate without visible gain here. */
export function devicePixelScale(): number {
  return clamp(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1, 2);
}

/** Size the canvas to its wrapper's device-pixel dimensions. */
export function resizeCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  const rect = wrap.getBoundingClientRect();
  const dpr = devicePixelScale();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/** Insets are given in CSS pixels and scaled to device pixels here. */
export function plotBox(
  canvasWidth: number,
  canvasHeight: number,
  insets: PlotInsets,
  dpr = devicePixelScale()
): PlotBox {
  const left = insets.left * dpr;
  const right = insets.right * dpr;
  const top = insets.top * dpr;
  const bottom = insets.bottom * dpr;
  return {
    left,
    right,
    top,
    bottom,
    canvasWidth,
    canvasHeight,
    width: Math.max(1, canvasWidth - left - right),
    height: Math.max(1, canvasHeight - top - bottom),
    dpr
  };
}

/** Unit position (0..1) to an x pixel, left to right. */
export function unitToX(box: PlotBox, unit: number): number {
  return box.left + clamp(unit, 0, 1) * box.width;
}

/** Unit position (0..1) to a y pixel — 0 is the bottom, as an axis reads. */
export function unitToY(box: PlotBox, unit: number): number {
  return box.top + (1 - clamp(unit, 0, 1)) * box.height;
}

/** Inverse of `unitToX`, for hover readouts. */
export function xToUnit(box: PlotBox, x: number): number {
  return clamp((x - box.left) / box.width, 0, 1);
}

/** Inverse of `unitToY`. */
export function yToUnit(box: PlotBox, y: number): number {
  return clamp(1 - (y - box.top) / box.height, 0, 1);
}
