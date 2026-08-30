import type { detectPitchYin, analyzeSpectrum } from "../lib/dsp.js";
import type { detectChord } from "../lib/chord.js";
import type { frequencyToNote } from "../lib/music-theory.js";

declare global {
  type MusicLabApi = {
    detectPitchYin: typeof detectPitchYin;
    analyzeSpectrum: typeof analyzeSpectrum;
    detectChord: typeof detectChord;
    frequencyToNote: typeof frequencyToNote;
  };

  interface Window {
    MusicLab?: MusicLabApi;
    /** @deprecated Use MusicLab. */
    ToneChordLab?: MusicLabApi;
  }
}

export {};
