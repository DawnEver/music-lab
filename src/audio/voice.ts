/**
 * Voices: the app's only synthesiser.
 *
 * A voice is plain data — waveform, partials, envelope, filter — so a
 * click, a reference tone, an ear-training chord and a piano key differ in
 * data, not in code. Everything is scheduled at an absolute audio-clock
 * time and cleans itself up on `ended`, so nothing accumulates over a long
 * practice session.
 *
 * The envelope has two shapes, because instruments do. Without `sustain`
 * a note decays to silence across its whole duration — a pluck, a click, a
 * struck tine. With `sustain` it is attack → decay → hold → release, which
 * is the only way an organ or a bowed note can hold a level.
 */

export type Waveform = "sine" | "triangle" | "square" | "sawtooth" | "noise";

/**
 * A filter over the whole voice. `envelope` is the multiple of `frequency`
 * the cutoff starts at and falls from over the note: brightness that
 * decays with the sound is what a plucked string actually does, so one
 * number buys the difference between a pluck and an organ.
 */
export interface VoiceFilter {
  type: BiquadFilterType;
  /** Cutoff in Hz at the end of the note. */
  frequency: number;
  q?: number;
  envelope?: number;
}

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
  /** Level held after the attack, as a fraction of peak. Absent = a pluck. */
  sustain?: number;
  /** Seconds from peak down to the sustain level. */
  decay?: number;
  /** Seconds from the sustain level to silence, at the end of the note. */
  release?: number;
  /**
   * Relative gain of a noise layer riding on the note. A flute without it
   * is a sine: the breath is not decoration, it is most of the sound.
   */
  breath?: number;
  filter?: VoiceFilter;
}

/** A note that is still sounding, waiting for the finger to come off. */
export interface HeldVoice {
  /** Damp the note at an absolute audio time (default: now). */
  release(time?: number): void;
}

export interface VoicePlayer {
  /**
   * Sound a spec at an absolute `AudioContext.currentTime`. Velocity 0..1
   * scales loudness and, when the voice has a filter envelope, brightness —
   * hitting harder opens the filter, as it does on the instrument.
   */
  play(spec: VoiceSpec, time: number, velocity?: number): void;
  /**
   * Start a note and keep it sounding until it is released. A sustaining
   * timbre holds its level; a plucked one decays on its own and release
   * only damps what is left, which is what taking a finger off a piano
   * key actually does.
   */
  hold(spec: VoiceSpec, time: number, velocity?: number): HeldVoice;
  setVolume(value: number): void;
  dispose(): void;
}

/** The floor an exponential ramp can reach; 0 is not a legal target. */
const SILENT = 0.0001;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
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

/** Total sounding time: never shorter than the attack it has to fit. */
export function voiceSeconds(spec: VoiceSpec): number {
  const attack = Math.max(0.001, spec.attack ?? 0.001);
  return Math.max(spec.duration, attack + 0.01);
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

  /** A looping noise band an octave above the note, for breath. */
  function breathSource(spec: VoiceSpec, at: number, destination: AudioNode) {
    if (!noise) noise = noiseBuffer(context);
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = context.createBiquadFilter();
    band.type = "highpass";
    band.frequency.value = spec.frequency * 2;
    source.connect(band);
    band.connect(destination);
    source.start(at);
    return { source, band };
  }

  function envelope(spec: VoiceSpec, at: number, gain: number): GainNode {
    const node = context.createGain();
    const attack = Math.max(0.001, spec.attack ?? 0.001);
    const total = voiceSeconds(spec);
    const peak = Math.max(gain, 2 * SILENT);

    node.gain.setValueAtTime(SILENT, at);
    node.gain.exponentialRampToValueAtTime(peak, at + attack);

    if (spec.sustain === undefined) {
      node.gain.exponentialRampToValueAtTime(SILENT, at + total);
    } else {
      const room = total - attack;
      const release = clamp(spec.release ?? 0.08, 0.005, room);
      const decay = clamp(spec.decay ?? 0.02, 0, room - release);
      const level = Math.max(peak * clamp(spec.sustain, 0, 1), 2 * SILENT);
      node.gain.exponentialRampToValueAtTime(level, at + attack + decay);
      node.gain.setValueAtTime(level, at + total - release);
      node.gain.exponentialRampToValueAtTime(SILENT, at + total);
    }

    node.connect(out);
    return node;
  }

  /** The filter, already swept, or null when the voice has none. */
  function filter(spec: VoiceSpec, at: number, velocity: number): BiquadFilterNode | null {
    if (!spec.filter) return null;
    const node = context.createBiquadFilter();
    node.type = spec.filter.type;
    if (spec.filter.q !== undefined) node.Q.value = spec.filter.q;

    const target = spec.filter.frequency;
    const open = spec.filter.envelope ?? 1;
    if (open > 1) {
      // Harder playing starts brighter; the sweep always lands on `frequency`.
      const start = target * (1 + (open - 1) * velocity);
      node.frequency.setValueAtTime(start, at);
      node.frequency.exponentialRampToValueAtTime(target, at + voiceSeconds(spec));
    } else {
      node.frequency.setValueAtTime(target, at);
    }
    return node;
  }

  function tone(
    spec: VoiceSpec,
    at: number,
    frequency: number,
    gain: number,
    velocity: number
  ): void {
    const total = voiceSeconds(spec);
    const node = envelope(spec, at, gain);
    const shaper = filter(spec, at, velocity);
    const oscillator = context.createOscillator();
    oscillator.type = spec.waveform === "noise" ? "sine" : spec.waveform;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (spec.glide && spec.glide !== 1) {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * spec.glide, at + total);
    }
    if (shaper) {
      oscillator.connect(shaper);
      shaper.connect(node);
    } else {
      oscillator.connect(node);
    }
    oscillator.start(at);
    oscillator.stop(at + total + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      shaper?.disconnect();
      node.disconnect();
    };
  }

  /** The envelope of a note with no known end. */
  function heldEnvelope(spec: VoiceSpec, at: number, gain: number): GainNode {
    const node = context.createGain();
    const attack = Math.max(0.001, spec.attack ?? 0.001);
    const peak = Math.max(gain, 2 * SILENT);

    node.gain.setValueAtTime(SILENT, at);
    node.gain.exponentialRampToValueAtTime(peak, at + attack);
    if (spec.sustain === undefined) {
      // No sustain: the note decays by itself, as a struck string does.
      node.gain.exponentialRampToValueAtTime(SILENT, at + voiceSeconds(spec));
    } else {
      const level = Math.max(peak * clamp(spec.sustain, 0, 1), 2 * SILENT);
      node.gain.exponentialRampToValueAtTime(level, at + attack + (spec.decay ?? 0.02));
    }
    node.connect(out);
    return node;
  }

  return {
    play(spec: VoiceSpec, time: number, velocity = 1) {
      const at = Math.max(time, context.currentTime);
      const level = clamp(velocity, 0, 1);
      if (level <= 0) return;

      if (spec.waveform === "noise") {
        if (!noise) noise = noiseBuffer(context);
        const total = voiceSeconds(spec);
        const node = envelope(spec, at, spec.gain * level);
        const source = context.createBufferSource();
        source.buffer = noise;
        const shaper = context.createBiquadFilter();
        shaper.type = "highpass";
        shaper.frequency.value = spec.frequency;
        source.connect(shaper);
        shaper.connect(node);
        source.start(at);
        source.stop(at + total + 0.02);
        source.onended = () => {
          source.disconnect();
          shaper.disconnect();
          node.disconnect();
        };
        return;
      }

      tone(spec, at, spec.frequency, spec.gain * level, level);
      spec.partials?.forEach((relative, index) => {
        if (relative <= 0) return;
        tone(spec, at, spec.frequency * (index + 2), spec.gain * level * relative, level);
      });

      if (spec.breath && spec.breath > 0) {
        const total = voiceSeconds(spec);
        const node = envelope(spec, at, spec.gain * level * spec.breath);
        const { source, band } = breathSource(spec, at, node);
        source.stop(at + total + 0.02);
        source.onended = () => {
          source.disconnect();
          band.disconnect();
          node.disconnect();
        };
      }
    },
    hold(spec: VoiceSpec, time: number, velocity = 1): HeldVoice {
      const at = Math.max(time, context.currentTime);
      const level = clamp(velocity, 0, 1);
      const release = Math.max(0.005, spec.release ?? 0.08);
      const natural = at + voiceSeconds(spec);

      // One envelope for the whole note; each partial rides a plain gain
      // under it, so the relative harmonic balance is fixed for the note.
      const node = heldEnvelope(spec, at, spec.gain * level);
      const shaper = filter(spec, at, level);
      if (shaper) shaper.connect(node);
      const input = shaper ?? node;

      const parts: AudioNode[] = [];
      const sources: AudioScheduledSourceNode[] = [];
      const addTone = (harmonic: number, relative: number) => {
        const oscillator = context.createOscillator();
        oscillator.type = spec.waveform === "noise" ? "sine" : spec.waveform;
        oscillator.frequency.setValueAtTime(spec.frequency * harmonic, at);
        if (relative === 1) {
          oscillator.connect(input);
        } else {
          const trim = context.createGain();
          trim.gain.value = relative;
          oscillator.connect(trim);
          trim.connect(input);
          parts.push(trim);
        }
        oscillator.start(at);
        sources.push(oscillator);
      };

      addTone(1, 1);
      spec.partials?.forEach((relative, index) => {
        if (relative > 0) addTone(index + 2, relative);
      });

      if (spec.breath && spec.breath > 0) {
        const trim = context.createGain();
        trim.gain.value = spec.breath;
        trim.connect(input);
        const { source, band } = breathSource(spec, at, trim);
        parts.push(trim, band);
        sources.push(source);
      }

      let endsAt = Infinity;
      const stop = (endAt: number) => {
        if (endAt >= endsAt) return;
        endsAt = endAt;
        let alive = sources.length;
        for (const source of sources) {
          source.stop(endAt + 0.02);
          source.onended = () => {
            source.disconnect();
            alive -= 1;
            if (alive > 0) return;
            for (const part of parts) part.disconnect();
            shaper?.disconnect();
            node.disconnect();
          };
        }
      };

      // A voice with no sustain ends on its own even if nobody releases it.
      if (spec.sustain === undefined) stop(natural);

      return {
        release(releaseAt = context.currentTime) {
          const from = Math.max(releaseAt, at, context.currentTime);
          if (from + release >= endsAt) return;
          const param = node.gain as AudioParam & {
            cancelAndHoldAtTime?: (time: number) => void;
          };
          if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(from);
          else param.cancelScheduledValues(from);
          param.exponentialRampToValueAtTime(SILENT, from + release);
          stop(from + release);
        }
      };
    },
    setVolume(value: number) {
      out.gain.setTargetAtTime(clamp(value, 0, 1), context.currentTime, 0.01);
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
