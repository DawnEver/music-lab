import type { detectPitchYin, analyzeSpectrum } from "../lib/dsp.js";
import type { detectChord } from "../lib/chord.js";
import type { frequencyToNote } from "../lib/music-theory.js";

declare global {
  interface Window {
    ToneChordLab?: {
      detectPitchYin: typeof detectPitchYin;
      analyzeSpectrum: typeof analyzeSpectrum;
      detectChord: typeof detectChord;
      frequencyToNote: typeof frequencyToNote;
    };
  }
}

export {};
