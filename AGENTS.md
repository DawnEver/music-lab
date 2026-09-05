# Development Principles

## Language
- Code and file contents in English; conversation may be in Chinese.
- UI copy lives in the i18n dictionary. Chinese UI text uses 调音, never 校音.

## What this app is
Three primitives: **sound in** (source → frames → features), **sound out** (schedule → voices), **musical meaning** (pure maths). Every tool is a combination; sight-singing is all three. A tool needing both directions is normal, so both live in `audio/` — if two features need the same thing, move the layer, never relax the boundary.

## Architecture
- One-way layers `features → audio → lib`:
  - `lib/` is pure and must run in Node: no `audio/` imports, no DOM or Web Audio globals.
  - `audio/` is the only layer that names Web Audio: context lease, input session, capture taps, analysis stream, transport, voices.
  - `features/*` compose and present; they never import each other, and only the router names a feature view.
  These are enforced by a test over the import graph, not by convention.
- One AudioContext, leased from `audio/context.ts`; `new AudioContext` appears exactly once in the repo.
- **One time base: `AudioContext.currentTime`** — spectrogram columns, sung notes, clicks and answer timestamps all come from it, which is why a written line and a sung line need no alignment code. Never use `performance.now()` for anything compared with sound. Units are named where they differ (`nowMs` in the pipeline, seconds elsewhere). Anything an rAF loop reads from the clock must be read *inside the loop*: the clock is not reactive, so a `computed` window is evaluated once and then draws the same long-gone seconds forever.
- Input is an application-level session (`audio/source.ts`): the player picks a microphone once. Views attach *taps* (`audio/capture.ts`) that survive a source change. A tap is an instance because the trade-off is per-view — pitch detection wants a long window, a time axis a short one with smoothing off.
- Feature layering: `domain/` pure functions → `engine/` scheduling and sound → `stores/` → UI. Audio is the master clock and the UI follows it through rAF.
- Features depend on the `Transport` interface, never the native implementation. The scheduler is generic over its event (it reads only `delta` and `silent`). A short, fully known phrase is placed on the clock in one go; the look-ahead scheduler is for streams that never end.
- Metronome edits land on the next event, not the next bar: the cursor re-reads pattern and tempo per event and nothing beyond the horizon is committed. Only meter is snapshotted at the bar line, because changing bar length mid-bar destroys the count.
- `AnalysisPipeline` owns every analysis decision (cadence, YIN/spectral arbitration, smoothing, silence) and takes frames plus a clock; `audio/analysis.ts` is only the adapter. One number cannot serve two masters: the needle reads the smoothed pitch, anything plotting or grading a moment reads the raw one.
- Plotting: `lib/plot/scale.ts` is the single source of "where does this value sit" (domain → 0..1, axis-agnostic); colours come from `--plot-*` tokens via `lib/plot/palette.ts`. The canvas paints its own surface, ramps come in dark-page and light-page families, and tick density is budgeted by available pixels — colliding labels read as damage. Canvases draw imperatively through `onFrame` and never enter Vue reactivity.
- History is a ring of columns stamped with audio time, and a view is a *query* over it — never a canvas scrolled a pixel per frame, which ties the time axis to the frame rate and kills freezing, zooming and replay.
- A pitch line has rules a heat map does not: break it where the signal is unvoiced, and fold one-off octave errors back onto it (a real leap is held; an artefact lasts a frame).
- Everything enumerable is data: instruments, click banks, voices, exercise types, colour ramps. Adding one is a new row, never a new code path.
- One tuning model: a preset is a list of `TuningTarget`s. Strings, tines, harmonica holes and wind fingerings differ only in data, so matching, selection and the needle exist once; a new family adds a renderer (`list` / `grid` / `fingering`). Adding an instrument ≈ one data file, with the detector band derived by `deriveRange`.
- Feature state lives in `features/*/stores/`; importing a store has no side effect — persisted state is read in an explicit `hydrate*()` the view calls, and always through `lib/persist.ts` (`ml.` prefix, legacy key migration), never `localStorage` directly.
- Compatibility code carries an expiry: the `tcl-` keys and the legacy hash-route mapping retire in v3.0.
- Styles have one source: `.card` owns shell and padding; differences are variant classes (`card--wide` / `card--tall` / `card--stack` / `card--glow*`).

## Interaction
- One tool per route, named for what the player is doing: `/tune`, `/trace`, `/rhythm`, `/ear`. Renamed routes keep redirects; the shell owns navigation only.
- A graph belongs to the trace, not the tuner: a tuner's answer is one number, so the instant spectrum and the time view live together in `/trace`.
- Layout follows use: the tuning workbench shows many readouts at once (collapsible cards); the metronome, trace and ear training each have one focus that never scrolls.
- Settings placement follows one test — is the knob part of the loop? A meter is set once and then played, so it hides behind the value it changes (`ControlSheet`). A dB floor is set while watching the picture, so the trace lays every knob flat under the canvas on a wide screen and the same component goes in a sheet on a phone. One definition, two placements, never two copies.
- `AudioSource` is one shared control (state, level, device) placed by each tool that offers an input — never in the shell, never in a tool with no use for a microphone.
- The primary action is never disabled: if sight-singing needs a microphone, pressing start acquires one.
- A control labelled with its own current state is ambiguous. Choices are segmented with every option visible and the current one marked; only genuine on/off switches are single chips. Group controls by the question they answer.
- Practice tools run the loop themselves — answer, verdict, next question, with no click in between. Automation is the default with a visible off switch.
- Practice draws are not uniform random: refuse an immediate repeat and lean towards what was recently missed. Progress can always be reset.
- Sight-singing means reading: the line is written as a staff or numbered notation, laid out by pure functions in `lib/notation.ts`. A pitch plot is the result, not the exercise.
- Register is a setting, not an error — sounding, drawing and grading follow it while the written line stays put.
- The app never records its own voice: capture is held while a reference tone, count-in or preview is sounding.

## Workflow
- Test-driven: failing test first, then the minimal change that passes it.
- Commit only when `npm test` is green and `vue-tsc --noEmit` is clean; conventional prefixes (`feat:` / `fix:` / `refactor:` / `chore:`).
- Three test layers: unit for logic (Node), `tests/components/` for component behaviour (happy-dom, real components), `npm run smoke` for what only a browser answers — geometry, overflow, routing, i18n. Smoke starts its own dev server; UI changes must run it on both viewports.
- Anything with randomness takes an injected random source, so questions, practice patterns and melodies are reproducible.
- Features whose point is the round trip are tested through it: sight-singing's smoke test installs an oscillator as the microphone, reads the written line off the page and performs it at tempo. A fake capture device cannot sing what is on the screen.
- `package.json` is the single source of the version; the tracked `pre-push` hook tags `v<version>`. Bump it when releasing.

## Data & i18n Correctness
- Instrument data (note tables, bend depths, ranges) and rhythm behaviour (meters, accents, subdivision/swing, tempo maths, scheduler with an injected clock) are locked by per-note and per-case tests: change the data, change the tests.
- Analysis and plotting are locked as pure functions in Node: band reduction, ring-buffer windows, ramp monotonicity, pitch-track segmentation, interval tables, exercise generation, sung-note verdicts, notation layout.
- The dictionary is split by owner (`lib/i18n/dictionaries/{shell,tuning,metronome,trace,ear}.ts`); zh/en parity and no duplicate key are enforced by tests.
- `t()` takes a typed `MessageKey`; keys built from a union type-check only if every member exists, so keep such sets closed (`SoundBankId`, `ChordTypeKey`, `ColormapId`, `IntervalKey`, `ExerciseKind`) rather than widening to `string`.
