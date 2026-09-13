/**
 * What the three tiers sound like, measured instead of guessed.
 *
 * `synth`, `hybrid` and `samples` are three answers to the same question —
 * what does this instrument sound like — and until now the only way to
 * compare them was to put on headphones and try to remember the previous
 * one. That is a comparison made of memory, at a level that moves by
 * decibels, and it is not repeatable: nobody can say whether last week's
 * change to a model made it closer to the recording or further from it.
 *
 * So this renders all three through the app's own engine — the same
 * `createPerformer`, the same `createVoicePlayer`, the same physical
 * models and the same FluidR3 recordings — into an `OfflineAudioContext`,
 * and reports two things:
 *
 *  - **numbers**, for the properties a listener actually names when they
 *    say a timbre is wrong: how fast it starts, how long it rings, how
 *    bright it is at the attack and how that brightness falls away, and
 *    the relative strength of the first sixteen harmonics.
 *  - **files**, written as WAVs at a matched level, so the same notes can
 *    be A/B'd by ear. The numbers say where the difference is; only an ear
 *    can say whether it matters.
 *
 * The recording is the reference. `samples` is what the instrument really
 * sounds like, so the distance that matters is the model's distance from
 * it — which is why every table puts the three side by side and the
 * summary leads with `synth -> samples`.
 *
 * A run writes `timbre-report.json` into the output directory. Run it
 * again after changing a model or a timbre and the second run reads the
 * first one back as a baseline, so "did that help?" is a number rather
 * than a feeling. That is the feedback loop; the numbers are its spine and
 * the WAVs are its ears.
 *
 * The engine is imported from the dev server, so this needs `npm run dev`
 * (or `--url` pointing at one). Rendering through the built bundle is not
 * possible: the modules are only addressable by name in dev.
 *
 * Usage:
 *   node scripts/timbre-report.mjs [--url=…] [--out=…] [--instrument=…,]
 *                                  [--notes=48,60,72] [--tiers=…,] [--all]
 *                                  [--seconds=2.2] [--no-files]
 */

import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Instruments compared by default: the ones a player asks about by name. */
const DEFAULT_INSTRUMENTS = ["piano", "epiano", "organ"];
const DEFAULT_NOTES = [48, 60, 72];
const DEFAULT_TIERS = ["samples", "hybrid", "synth"];

/**
 * How much of each note is rendered, in seconds. Long enough for a struck
 * note's decay to be a fact rather than a guess, short enough that a
 * twenty-seven-case run is a couple of seconds.
 */
const DEFAULT_SECONDS = 2.2;

function flags(argv) {
  const out = {};
  for (const entry of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(entry);
    if (!match) continue;
    out[match[1]] = match[2] ?? "true";
  }
  return out;
}

const args = flags(process.argv.slice(2));
const url = args.url ?? "http://localhost:5173";
const outDir = args.out ?? "timbre-report";
const seconds = Number(args.seconds ?? DEFAULT_SECONDS);
const writeFiles = args["no-files"] === undefined;
const instruments = args.all !== undefined
  ? null
  : (args.instrument ? String(args.instrument).split(",") : DEFAULT_INSTRUMENTS);
const notes = (args.notes ? String(args.notes).split(",") : DEFAULT_NOTES).map(Number);
const tiers = args.tiers ? String(args.tiers).split(",") : DEFAULT_TIERS;

/*
 * Everything below runs inside the page, because that is the only place
 * the engine can be reached: a bank has to be fetched and decoded with a
 * real `decodeAudioData`, and the physical models need a context to become
 * buffers. Both work offline — `OfflineAudioContext` is a
 * `BaseAudioContext` and can decode — so nothing has to be heard to be
 * measured.
 */
async function measureInPage({ instruments, notes, tiers, seconds }) {
  const [{ createPerformer }, { createVoicePlayer }, soundfont, instrumentsModule] = await Promise.all([
    import("/src/features/play/engine/performer.ts"),
    import("/src/audio/voice.ts"),
    import("/src/audio/soundfont.ts"),
    import("/src/instruments/index.ts")
  ]);
  const { sampleNow, percussionNow, prepare } = soundfont;

  const SAMPLE_RATE = 48000;

  /** One note of one tier of one instrument, as raw samples. */
  async function render(instrument, tier, midi) {
    // Two channels, like the app's own output: a bank is stereo and a model
    // is mono, so a mono bench would quietly dock the recordings three
    // decibels and put that error straight into the level comparison.
    const context = new OfflineAudioContext(2, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
    const player = createVoicePlayer(context, context.destination, 1);
    const performer = createPerformer({
      player,
      context,
      now: () => 0,
      timbreId: instrument.timbre ?? "singable",
      // The app's own tuning; a report about timbre must not also be a
      // report about a different temperament.
      tuning: 440,
      tier,
      sample: instrument.sample,
      takeSample: sampleNow,
      takePercussion: percussionNow
    });
    performer.noteOn(midi, 0.8);
    const rendered = await context.startRendering();
    performer.dispose();
    return rendered.getChannelData(0).slice();
  }

  /** Hann window, so a harmonic that falls between bins is not lost. */
  function hann(n, length) {
    return 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1));
  }

  /**
   * The amplitude at one exact frequency, by Goertzel rather than by FFT.
   *
   * A pitched instrument's timbre is its harmonics, and they sit at known
   * frequencies — so there is nothing to search for and no reason to pay
   * for a whole spectrum. Evaluated at the exact bin the harmonic falls
   * on, including between bins, which an FFT cannot do without
   * interpolation.
   */
  function harmonicAmplitude(x, f0, startSample, length) {
    const k = (f0 * length) / SAMPLE_RATE;
    const coefficient = 2 * Math.cos((2 * Math.PI * k) / length);
    let s1 = 0;
    let s2 = 0;
    for (let n = 0; n < length; n++) {
      const index = startSample + n;
      const sample = index < x.length ? x[index] * hann(n, length) : 0;
      const s0 = sample + coefficient * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coefficient * s1 * s2));
  }

  /** The first sixteen harmonics at one instant, and the brightness they sum to. */
  function profile(x, f0, atSeconds, length = 4096) {
    const start = Math.round(atSeconds * SAMPLE_RATE);
    const amplitudes = [];
    let weighted = 0;
    let total = 0;
    for (let h = 1; h <= 16; h++) {
      const hz = f0 * h;
      // Past a quarter of the sample rate a harmonic is mostly an artefact
      // of the window rather than a fact about the instrument.
      if (hz > SAMPLE_RATE / 4) {
        amplitudes.push(null);
        continue;
      }
      const amplitude = harmonicAmplitude(x, hz, start, length);
      amplitudes.push(amplitude);
      weighted += hz * amplitude;
      total += amplitude;
    }
    const first = amplitudes[0] || 1;
    return {
      centroidHz: total > 0 ? weighted / total : 0,
      /** Each harmonic against the fundamental, in dB. */
      harmonicsDb: amplitudes.map((a) => (a === null ? null : 20 * Math.log10(Math.max(a, 1e-9) / first)))
    };
  }

  /** The loudness envelope, in 10ms frames, and what it says about the note. */
  function envelope(x) {
    const step = Math.round(SAMPLE_RATE * 0.01);
    const frames = [];
    for (let start = 0; start + step <= x.length; start += step) {
      let sum = 0;
      for (let i = 0; i < step; i++) sum += x[start + i] * x[start + i];
      frames.push(Math.sqrt(sum / step));
    }
    let peak = 0;
    for (const value of x) peak = Math.max(peak, Math.abs(value));
    const loudest = Math.max(...frames, 1e-9);
    const loudestAt = frames.indexOf(loudest);

    /*
     * Loudness, over the same window the engine calibrates in. This is the
     * number a listener means by "level", and it is the number the two
     * tiers are supposed to agree on — `render.ts` and `soundfont.ts` both
     * aim a note at the same RMS over its first fifth of a second. Peak is
     * a different question and deliberately not equalised: a plucked model
     * has a taller transient than the recording it stands in for, and
     * flattening that would be clipping, not matching.
     */
    const window = Math.min(x.length, Math.round(SAMPLE_RATE * 0.2));
    let sum = 0;
    for (let i = 0; i < window; i++) sum += x[i] * x[i];
    const loudnessDb = 20 * Math.log10(Math.max(Math.sqrt(sum / Math.max(1, window)), 1e-9));

    // Attack is measured to the loudest frame, not to a threshold: an
    // organ and a piano both start "immediately" by any threshold, and what
    // separates them is how long they take to get there.
    const attackMs = loudestAt * 10;
    const at = (seconds) => frames[Math.round(seconds * 100)] ?? 0;
    const sustained = at(1) / loudest;
    // How long the note takes to fall 20dB below its own peak, searched
    // after the peak so a percussive onset is not mistaken for a decay.
    let twentieth = frames.length - 1;
    for (let i = loudestAt; i < frames.length; i++) {
      if (frames[i] <= loudest / 10) {
        twentieth = i;
        break;
      }
    }
    return {
      peakDb: 20 * Math.log10(Math.max(peak, 1e-9)),
      loudnessDb,
      attackMs,
      /** Seconds to 20dB down — a struck note's ring, near enough. */
      t20: (twentieth - loudestAt) * 0.01,
      /** Level a second in, against the peak, in dB. */
      sustainDb: 20 * Math.log10(Math.max(sustained, 1e-9))
    };
  }

  /** 16-bit mono WAV, so a difference in timbre can be heard and not only read. */
  function encodeWav(x, gain) {
    const buffer = new ArrayBuffer(44 + x.length * 2);
    const view = new DataView(buffer);
    const ascii = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, "RIFF");
    view.setUint32(4, 36 + x.length * 2, true);
    ascii(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) {
      const sample = Math.max(-1, Math.min(1, x[i] * gain));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }

  const chosen = (instruments ?? instrumentsModule.playableInstruments
    .filter((entry) => entry.sample)
    .map((entry) => entry.id))
    .map((id) => instrumentsModule.getPlayableInstrument(id))
    .filter((entry) => entry && entry.sample);

  const cases = [];
  for (const instrument of chosen) {
    // Fetch and decode the bank once per instrument. Every render gets a
    // fresh context, but the decoded bank is module-level, so this is one
    // network round trip per instrument rather than one per case.
    const context = new OfflineAudioContext(1, 1024, SAMPLE_RATE);
    await prepare(context, instrument.sample);

    for (const midi of notes) {
      /*
       * What the recording was, before anything was done to it.
       *
       * Both tiers are meant to arrive at the same loudness — `render.ts`
       * calibrates a model and `soundfont.ts` scales a recording by the
       * same rule — but the recording's rule carries a clamp the model's
       * does not, so a bank that is quiet enough to need more than the
       * clamp gets less gain than it asked for. That is invisible in the
       * app and obvious here, which is the reason to measure it.
       */
      const take = instrument.sample ? sampleNow(instrument.sample, midi) : null;
      let recording = null;
      if (take) {
        const data = take.buffer.getChannelData(0);
        const window = Math.min(data.length, Math.round(0.2 * take.buffer.sampleRate));
        let sum = 0;
        let peak = 0;
        for (let index = 0; index < data.length; index += 1) {
          if (index < window) sum += data[index] * data[index];
          peak = Math.max(peak, Math.abs(data[index]));
        }
        const rms = Math.sqrt(sum / Math.max(1, window));
        recording = {
          rmsDb: 20 * Math.log10(Math.max(rms, 1e-9)),
          peakDb: 20 * Math.log10(Math.max(peak, 1e-9)),
          gain: take.gain,
          /** True when the clamp, rather than the loudness, decided the level. */
          clamped: take.gain >= 20
        };
      }

      for (const tier of tiers) {
        const samples = await render(instrument, tier, midi);
        const f0 = 440 * Math.pow(2, (midi - 69) / 12);
        const shape = envelope(samples);
        // Every file is written at the same peak, so a difference heard in
        // the A/B is a difference in timbre rather than in level. The real
        // peak is in the table for anyone who wants to see it.
        const normalization = 0.7 / Math.pow(10, shape.peakDb / 20);
        cases.push({
          instrument: instrument.id,
          name: instrument.name.en,
          midi,
          tier,
          recording,
          ...shape,
          windows: [0.03, 0.3, 0.9].map((at) => ({ at, ...profile(samples, f0, at) })),
          wav: {
            name: `${instrument.id}-${tier}-${midi}.wav`,
            data: encodeWav(samples, normalization)
          }
        });
      }
    }
  }
  return cases;
}

/**
 * How far one tier is from the recording, as one number.
 *
 * Two halves, because a timbre can be wrong in two independent ways: the
 * balance of its harmonics (what it sounds like) and the shape of its
 * envelope (when it sounds like it). Both are in dB, both are averaged
 * over the three windows, and the sum is a heuristic — it ranks
 * differences, it does not decide what is good. Ears still do that.
 */
function distanceFromRecording(measured, reference) {
  if (!reference) return null;
  let harmonic = 0;
  let counted = 0;
  for (let w = 0; w < measured.windows.length; w++) {
    const mine = measured.windows[w].harmonicsDb;
    const theirs = reference.windows[w].harmonicsDb;
    for (let h = 1; h < Math.min(mine.length, theirs.length); h++) {
      if (mine[h] === null || theirs[h] === null) continue;
      harmonic += Math.abs(mine[h] - theirs[h]);
      counted += 1;
    }
  }
  const envelopeError =
    Math.abs(measured.attackMs - reference.attackMs) / 100 +
    Math.abs(20 * Math.log10(Math.max(measured.t20, 0.01) / Math.max(reference.t20, 0.01))) +
    Math.abs(measured.sustainDb - reference.sustainDb);
  return {
    harmonicsDb: counted ? harmonic / counted : 0,
    envelopeDb: envelopeError,
    total: (counted ? harmonic / counted : 0) + envelopeError
  };
}

function table(cases) {
  const lines = [];
  const header = ["instrument", "note", "tier", "peak dB", "attack ms", "t20 s", "1s dB", "centroid Hz @30ms @300ms @900ms"];
  lines.push(header.join("\t"));
  for (const entry of cases) {
    lines.push([
      entry.instrument,
      midiName(entry.midi),
      entry.tier,
      entry.peakDb.toFixed(1),
      entry.attackMs.toFixed(0),
      entry.t20.toFixed(2),
      entry.sustainDb.toFixed(1),
      entry.windows.map((w) => w.centroidHz.toFixed(0)).join(" ")
    ].join("\t"));
  }
  return lines.join("\n");
}

function midiName(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The whole point: the model's distance from the recording, per instrument. */
function summary(cases, baseline) {
  const keys = [...new Set(cases.map((entry) => `${entry.instrument} ${midiName(entry.midi)}`))];
  const lines = [];
  lines.push("distance from the recording, in dB (harmonics/envelope, lower is closer)");
  lines.push(
    ["case", ...tiers.map((tier) => tier.padEnd(8)), "loudness dB", "synth vs last run"].join("\t")
  );
  let worst = null;
  const levels = [];
  for (const key of keys) {
    const group = cases.filter((entry) => `${entry.instrument} ${midiName(entry.midi)}` === key);
    const reference = group.find((entry) => entry.tier === "samples");
    const cells = [];
    let synthTotal = null;
    for (const tier of tiers) {
      const entry = group.find((item) => item.tier === tier);
      if (!entry) {
        cells.push("-".padEnd(8));
        continue;
      }
      if (tier === "samples") {
        cells.push("reference".padEnd(8));
        continue;
      }
      const distance = distanceFromRecording(entry, reference);
      if (!distance) continue;
      // The reference is the recording, so a tier that is further from it
      // than another is the one to work on. Harmonics are what the ear
      // names first, so they lead the column.
      cells.push(`${distance.harmonicsDb.toFixed(1)}/${distance.envelopeDb.toFixed(1)}`.padEnd(8));
      if (tier === "synth") {
        synthTotal = distance.total;
        if (!worst || distance.harmonicsDb > worst.harmonicsDb) worst = { key, distance };
      }
    }
    let delta = "n/a";
    if (baseline) {
      const before = baseline.find((entry) => entry.instrument === group[0].instrument && entry.midi === group[0].midi && entry.tier === "synth");
      const beforeReference = baseline.find((entry) => entry.instrument === group[0].instrument && entry.midi === group[0].midi && entry.tier === "samples");
      const was = before ? distanceFromRecording(before, beforeReference) : null;
      if (was && synthTotal !== null) {
        const move = was.total - synthTotal;
        delta = `${move >= 0 ? "-" : "+"}${Math.abs(move).toFixed(1)} ${move >= 0 ? "closer" : "further"}`;
      }
    }
    /*
     * How far apart the two tiers sit in level. A player comparing them by
     * ear is comparing loudness first and timbre second, so a gap here
     * makes every other number in the row harder to trust — and in the
     * hybrid tier it is the whole story, because the recording is mixed
     * under the model rather than beside it.
     */
    const synth = group.find((entry) => entry.tier === "synth");
    const sampled = group.find((entry) => entry.tier === "samples");
    const hybrid = group.find((entry) => entry.tier === "hybrid");
    const gap = synth && sampled ? synth.loudnessDb - sampled.loudnessDb : null;
    if (gap !== null && Math.abs(gap) > 3) {
      const take = sampled.recording ?? synth.recording;
      levels.push(
        `${key}: the recording plays ${Math.abs(gap).toFixed(1)}dB ` +
          `${gap > 0 ? "under" : "over"} the model ` +
          `(bank rms ${take?.rmsDb.toFixed(1)}dB peak ${take?.peakDb.toFixed(1)}dB, ` +
          `gain ${take?.gain.toFixed(1)}x${take?.clamped ? ", clamped at the ceiling" : ""})`
      );
    }
    /*
     * Hybrid is two sources at once, so its loudness is a sum rather than
     * a level: the recording's attack is mixed under a model that is
     * already at the target. Anything here is the price of the layer.
     */
    const together = synth && hybrid ? hybrid.loudnessDb - synth.loudnessDb : null;
    if (together !== null && Math.abs(together) > 3) {
      levels.push(
        `${key}: hybrid plays ${Math.abs(together).toFixed(1)}dB ` +
          `${together > 0 ? "over" : "under"} the model it layers onto`
      );
    }
    lines.push([
      key.padEnd(16),
      ...cells,
      (gap === null ? "-" : gap.toFixed(1)).padEnd(8),
      delta
    ].join("\t"));
  }
  if (levels.length) {
    lines.push("");
    lines.push("level, which is what a listener hears first:");
    lines.push(...levels.map((line) => `  ${line}`));
  }
  if (worst) {
    lines.push("");
    lines.push(
      `furthest off: ${worst.key} — the model's harmonics differ from the recording by ` +
        `${worst.distance.harmonicsDb.toFixed(1)}dB on average (envelope ${worst.distance.envelopeDb.toFixed(1)}dB)`
    );
  }
  return lines.join("\n");
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"]
});
const page = await browser.newPage();

let cases;
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  cases = await page.evaluate(measureInPage, { instruments, notes, tiers, seconds });
} catch (error) {
  const message = String(error?.message ?? error);
  if (/Failed to fetch dynamically imported module|Cannot find module|404/.test(message)) {
    console.error(
      `timbre-report: could not import the engine from ${url}.\n` +
        "The report renders through the app's own modules, which only exist by name on a dev server — run `npm run dev` and pass --url."
    );
  } else {
    console.error(`timbre-report: ${message}`);
  }
  await browser.close();
  process.exit(1);
}
await browser.close();

await mkdir(outDir, { recursive: true });

let baseline = null;
try {
  baseline = JSON.parse(await readFile(join(outDir, "timbre-report.json"), "utf8"));
} catch (_) {
  // No previous run is not a problem: the first report is the baseline.
}

await writeFile(
  join(outDir, "timbre-report.json"),
  JSON.stringify(cases.map(({ wav, ...rest }) => rest), null, 2)
);

if (writeFiles) {
  for (const entry of cases) {
    await writeFile(join(outDir, entry.wav.name), Buffer.from(entry.wav.data, "base64"));
  }
}

console.log(table(cases));
console.log("");
console.log(summary(cases, baseline));
console.log("");
console.log(
  `${cases.length} notes rendered; ${writeFiles ? `WAVs and the report are in ${outDir}/` : "no files written"}`
);
if (baseline) {
  console.log("compared against the previous timbre-report.json in the same directory");
} else {
  console.log("this run is the baseline: run it again after a change to see whether it moved");
}
