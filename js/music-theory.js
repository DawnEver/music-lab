/**
 * Music theory helpers: note names, chord templates, and frequency
 * <-> MIDI conversions. Pure functions, safe to import in Node.
 */

export const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export const CHORD_TYPES = [
  { suffix: "", name: "大三和弦", intervals: [0, 4, 7], weights: [1, 0.90, 0.78] },
  { suffix: "m", name: "小三和弦", intervals: [0, 3, 7], weights: [1, 0.90, 0.78] },
  { suffix: "dim", name: "减三和弦", intervals: [0, 3, 6], weights: [1, 0.88, 0.75] },
  { suffix: "aug", name: "增三和弦", intervals: [0, 4, 8], weights: [1, 0.88, 0.78] },
  { suffix: "sus2", name: "挂二和弦", intervals: [0, 2, 7], weights: [1, 0.82, 0.78] },
  { suffix: "sus4", name: "挂四和弦", intervals: [0, 5, 7], weights: [1, 0.82, 0.78] },
  { suffix: "5", name: "五度和弦", intervals: [0, 7], weights: [1, 0.85] },
  { suffix: "7", name: "属七和弦", intervals: [0, 4, 7, 10], weights: [1, 0.88, 0.75, 0.62] },
  { suffix: "maj7", name: "大七和弦", intervals: [0, 4, 7, 11], weights: [1, 0.88, 0.75, 0.62] },
  { suffix: "m7", name: "小七和弦", intervals: [0, 3, 7, 10], weights: [1, 0.88, 0.75, 0.62] }
];

/** Convert a MIDI note number to a frequency in Hz. */
export function midiToFrequency(midi, tuning = 440) {
  return tuning * Math.pow(2, (midi - 69) / 12);
}

/** Convert a frequency in Hz to a fractional MIDI note number. */
export function frequencyToMidi(frequency, tuning = 440) {
  return 69 + 12 * Math.log2(frequency / tuning);
}

/**
 * Resolve a frequency to a note name, octave, and cents deviation
 * relative to the nearest equal-tempered note.
 */
export function frequencyToNote(frequency, tuning = 440) {
  const midiFloat = frequencyToMidi(frequency, tuning);
  const midi = Math.round(midiFloat);
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const targetFrequency = midiToFrequency(midi, tuning);
  const cents = 1200 * Math.log2(frequency / targetFrequency);
  return {
    midi,
    pitchClass,
    octave,
    name: NOTE_NAMES[pitchClass],
    frequency,
    cents
  };
}
