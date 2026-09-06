# Development Principles

Rules that change what you do. The reasoning behind them, and the bugs that
taught them, live in `.claude/memory/`.

## Language
Code and file contents in English; conversation may be in Chinese. UI copy lives in the i18n dictionary; Chinese UI text uses 调音, never 校音.

## What this app is
Three primitives — **sound in** (source → frames → features), **sound out** (schedule → voices), **musical meaning** (pure maths). Every tool is a combination; sight-singing is all three. A tool needing both directions is normal, so both live in `audio/`: when two features need the same thing, move the layer, never relax the boundary. Playing is sound out with no schedule — a note starts when a finger lands and ends when it lifts, so it is a register of what is down (`hold`/`release`), never the look-ahead scheduler.

## Architecture
- One-way layers `features → audio → lib`, enforced by a test over the import graph. `lib/` is pure and must run in Node (no `audio/`, no DOM or Web Audio globals); `audio/` is the only layer that names Web Audio; `features/*` never import each other, and only the router names a feature view.
- One AudioContext, leased from `audio/context.ts`.
- **One time base: `AudioContext.currentTime`.** Never `performance.now()` for anything compared with sound — this is why a written line and a sung line need no alignment code. Anything an rAF loop reads from the clock must be read *inside the loop*: the clock is not reactive, so a `computed` window is evaluated once and then draws the same long-gone seconds forever.
- Input is an application-level session (`audio/source.ts`): the player picks a microphone once. Views attach *taps* (`audio/capture.ts`) that survive a source change, and a tap is an instance because the trade-off is per-view — pitch detection wants a long window, a time axis a short one with smoothing off.
- Feature layering: `domain/` pure → `engine/` scheduling and sound → `stores/` → UI. Audio is the master clock; the UI follows it through rAF.
- Features depend on the `Transport` interface, never the implementation. The scheduler is generic over its event (`delta` and `silent` only). A short, fully known phrase goes on the clock in one go; look-ahead is for streams that never end.
- Metronome edits land on the next event, not the next bar. Only meter is snapshotted at the bar line, because changing bar length mid-bar destroys the count.
- `AnalysisPipeline` owns every analysis decision and takes frames plus a clock; `audio/analysis.ts` is only the adapter. One number cannot serve two masters: the needle reads the smoothed pitch, anything plotting or grading a moment reads the raw one.
- `lib/plot/scale.ts` is the single source of "where does this value sit" (domain → 0..1, axis-agnostic); colours come from `--plot-*` tokens. The canvas paints its own surface, ramps come in dark-page and light-page families, tick density is budgeted by available pixels, and canvases draw through `onFrame` outside Vue reactivity.
- History is a ring of columns stamped with audio time and a view is a *query* over it — never a canvas scrolled a pixel per frame, which ties the time axis to the frame rate and kills freezing, zooming and replay.
- A pitch line has rules a heat map does not: break it where the signal is unvoiced, and fold one-off octave errors back onto it (a real leap is held; an artefact lasts a frame).
- Everything enumerable is data — instruments, click banks, timbres, exercise types, colour ramps. Adding one is a new row, never a new code path. One tuning model (`TuningTarget`) covers strings, tines, holes and fingerings; a new family adds a renderer, and an instrument is one data file with its band from `deriveRange`.
- An instrument is an identity plus **optional capabilities**: `tuning` (appears in `/tune`), `timbre` + `surface` (appears in `/play`). A piano has no tuning a player sets and a kit has no pitch at all, so requiring either of everything is how the abstraction stops constraining anything. Narrow by capability (`TunedInstrument`, `PlayableInstrument`), never by a boolean flag.
- A timbre is note-independent data bound to a pitch by `timbreSpec()`, or to a bare frequency by `timbreSpecAt()` — percussion has a fundamental, not a note, and giving it a MIDI number puts it back among things that can be out of tune. Filter cutoffs are a harmonic of the note, so one timbre stays balanced across the range. What separates instruments is the envelope and the brightness over time, not the waveform.
- Feature state lives in `features/*/stores/`; importing a store has no side effect (an explicit `hydrate*()` reads persisted state, always via `lib/persist.ts`). Styles have one source: `.card` plus variant classes.
- Compatibility code carries an expiry: the `tcl-` keys and the legacy hash-route mapping retire in v3.0.

## Interaction
- One tool per route, named for what the player is doing: `/tune`, `/trace`, `/rhythm`, `/ear`, `/play`; renamed routes keep redirects. A graph belongs to the trace — a tuner's answer is one number.
- In `/play` the instrument is the only choice: its `surface` decides what is drawn (keys, frets, pads, holes) and its `timbre` decides what is heard. A separate voice menu would let the name and the sound disagree.
- A picker inside a `ControlSheet` must be chips, not a `v-select`: the menu overlay teleports out of the sheet, so choosing an option reads as clicking outside and closes the sheet under the pointer.
- Layout follows use: the tuning workbench shows many readouts at once; the other tools each have one focus that never scrolls.
- **No page-level width cap.** A maximum width is earned only by reading line length, and almost nothing here is prose — every main surface is more usable the wider it gets. The cap lives on the text that needs it. A tool's stage spans every dashboard column (`grid-column: 1 / -1`); smoke measures this, because a stage at half width reads as a broken app and no unit test can see it.
- **An instrument lays out in one row, and the column count is the instrument.** Six strings is a guitar; fourteen notes is two octaves of a scale. Sizing the grid from a pixel minimum (`auto-fill minmax`) wraps them into a ragged block and destroys the only order they have. A phone is the one exception: there an instrument keeps its shape and scrolls along its own axis rather than folding.
- A fret, a key or a pad carries its own name. An unlabelled box is not an instrument.
- **A key has a size, and both ends of it come from the hand.** A white key is never wider than a real one (23.5mm) and never narrower than a fingertip (9mm); between those the keyboard fills the room, above it centres, below it scrolls. Bounds stated in physical units say why they are those numbers.
- Settings placement follows one test — is the knob part of the loop? A meter is set once and then played, so it hides behind the value it changes (`ControlSheet`); a dB floor is set while watching the picture, so it stays on screen. One component, two placements, never two copies.
- `AudioSource` is one shared control placed by each tool that offers an input — never in the shell, never where there is no use for a microphone.
- The primary action is never disabled: if sight-singing needs a microphone, pressing start acquires one.
- A control labelled with its own current state is ambiguous. Choices are segmented with every option visible; only genuine on/off switches are single chips. Group controls by the question they answer.
- Practice tools run the loop themselves — answer, verdict, next question, no click in between — with a visible off switch. Draws refuse an immediate repeat and lean towards what was recently missed, and progress can always be reset.
- Sight-singing means reading: the line is written as a staff or numbered notation (`lib/notation.ts`). A pitch plot is the result, not the exercise. Register is a setting, not an error: sounding, drawing and grading follow it while the written line stays put.
- The app never records its own voice: capture is held while a reference tone, count-in or preview is sounding.

## Workflow
- Test-driven: failing test first, then the minimal change that passes it. Commit only when `npm test` is green and `vue-tsc --noEmit` is clean; conventional prefixes.
- Three layers, each with its own job: unit for logic (Node), `tests/components/` for component behaviour, `npm run smoke` for what only a browser answers — geometry, overflow, routing, i18n. UI changes must run smoke on both viewports.
- Anything with randomness takes an injected random source. Features whose point is the round trip are tested through it: sight-singing's smoke test installs an oscillator as the microphone, reads the written line off the page and performs it at tempo — a fake capture device cannot sing what is on the screen.
- `package.json` is the single source of the version; the `pre-push` hook tags `v<version>`. Bump it when releasing.

## Data & i18n
- Instrument data and rhythm behaviour are locked by per-note and per-case tests; change the data, change the tests. Analysis, plotting, notation, exercise generation and sung-note verdicts are pure functions tested in Node.
- The dictionary is split by owner (`lib/i18n/dictionaries/*`) with zh/en parity and no duplicate keys, enforced by tests. `t()` takes a typed `MessageKey`, so keep key-forming unions closed (`SoundBankId`, `ColormapId`, `IntervalKey`, `ExerciseKind`) rather than widening to `string`.
