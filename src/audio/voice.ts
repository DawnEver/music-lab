/**
 * Voices: the app's only synthesiser.
 *
 * A voice is plain data — waveform, partials, envelope — so a click, a
 * reference tone and an ear-training chord differ in data, not in code.
 * Everything is scheduled at an absolute audio-clock time and cleans itself
 * up on `ended`, so nothing accumulates over a long practice session.
 */

export type Waveform = "sine" | "triangle" | "square" | "sawtooth" | "noise";

export interface VoiceSpec {
  waveform: Waveform;
  /** Hz; for noise voices this is the high-pass corner. */
  frequency: number;
  /** Peak gain, 0..1. */
  gain: number;
  /** Seconds from onset to silence. */
  duration: number;
  /** Attack in seconds; short values read as percussive. */
  attack?: number;
  /**
   * Frequency multiplier reached at the end of the note. A slight downward
   * glide is what makes a beep read as a "click".
   */
  glide?: number;
  /**
   * Relative gains of harmonics 2..n. A little second and third harmonic is
   * the difference between a test tone and something singable.
   */
  partials?: number[];
}

export interface VoicePlayer {
  /** Sound a spec at an absolute `AudioContext.currentTime`. */
  play(spec: VoiceSpec, time: number): void;
  setVolume(value: number): void;
  dispose(): void;
}

function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createVoicePlayer(
  context: AudioContext,
  destination: AudioNode,
  volume = 0.8
): VoicePlayer {
  let noise: AudioBuffer | null = null;
  const out = context.createGain();
  out.gain.value = volume;
  out.connect(destination);

  function envelope(spec: VoiceSpec, at: number, gain: number): GainNode {
    const node = context.createGain();
    const attack = Math.max(0.001, spec.attack ?? 0.001);
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), at + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(spec.duration, attack + 0.01));
    node.connect(out);
    return node;
  }

  function tone(spec: VoiceSpec, at: number, frequency: number, gain: number): void {
    const node = envelope(spec, at, gain);
    const oscillator = context.createOscillator();
    oscillator.type = spec.waveform === "noise" ? "sine" : spec.waveform;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (spec.glide && spec.glide !== 1) {
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * spec.glide,
        at + spec.duration
      );
    }
    oscillator.connect(node);
    oscillator.start(at);
    oscillator.stop(at + spec.duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      node.disconnect();
    };
  }

  return {
    play(spec: VoiceSpec, time: number) {
      const at = Math.max(time, context.currentTime);

      if (spec.waveform === "noise") {
        if (!noise) noise = noiseBuffer(context);
        const node = envelope(spec, at, spec.gain);
        const source = context.createBufferSource();
        source.buffer = noise;
        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = spec.frequency;
        source.connect(filter);
        filter.connect(node);
        source.start(at);
        source.stop(at + spec.duration + 0.02);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          node.disconnect();
        };
        return;
      }

      tone(spec, at, spec.frequency, spec.gain);
      spec.partials?.forEach((relative, index) => {
        if (relative <= 0) return;
        tone(spec, at, spec.frequency * (index + 2), spec.gain * relative);
      });
    },
    setVolume(value: number) {
      out.gain.setTargetAtTime(Math.min(1, Math.max(0, value)), context.currentTime, 0.01);
    },
    dispose() {
      try {
        out.disconnect();
      } catch (_) {
        // Already detached.
      }
    }
  };
}
