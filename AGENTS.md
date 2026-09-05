# Development Principles

## Language & Terminology
- Write code and file contents in English; conversations may be in Chinese.
- UI copy lives in the i18n dictionary. Chinese UI text uses 调音 (tuning) consistently — never 校音.

## What this app is
- Three primitives, and every tool is a combination of them: **sound flowing in** (source -> frames -> features), **sound flowing out** (a schedule -> voices), and **musical meaning** (pure maths, no audio). Tuning and the trace are in + meaning; the metronome and ear training are out + meaning; sight-singing is all three.
- A tool needing both directions is normal, not exceptional. So both directions live in `audio/`, never inside a feature. If two features need the same thing, the thing is in the wrong layer — do not relax the boundary rules, move the layer.

## Architecture
- Layers, strictly one-way `features -> audio -> lib`:
  - `lib/` is pure: DSP, music theory, plot scales, spectrogram data, colour ramps, i18n, persist. It must keep running in Node, so it may not import `audio/` and may not name a DOM or Web Audio global.
  - `audio/` is the only layer that touches Web Audio: the context lease, the input session, capture taps, the analysis stream, the transport, the voices.
  - `features/*` compose and present. They never import each other; only the router names a feature view.
- One AudioContext for the whole app: everything takes a lease from `src/audio/context.ts` and never constructs or closes a context. `new AudioContext` appears exactly once in the repo, and a test enforces it.
- **One time base: `AudioContext.currentTime`.** Spectrogram columns, sung notes, metronome clicks and answer timestamps are all stamped from it. This is what lets a written line and a sung line be drawn together with no alignment code — never reintroduce `performance.now()` for anything that will be compared with sound. Units are named where they differ (`nowMs` in the analysis pipeline, `time` in seconds everywhere else).
- Input is an application-level session (`audio/source.ts`): the player picks a microphone once and the whole app is listening. Views attach *taps* (`audio/capture.ts`), which survive a source change. A tap is an instance, not a singleton, because the resolution trade-off is per-view: pitch detection wants a long window, a time axis wants a short one with smoothing off.
- Chrome belongs to whoever uses it, not to the shell: `AudioSource` is one shared control — state, level and device choice in a single row — placed by each tool that offers an input (tuning, trace). It never moves into the shell, and it never appears in a tool that has no use for a microphone; sight-singing has none because its start button acquires the input itself.
- One tool per route, named for what the player is doing: `/tune`, `/trace`, `/rhythm`, `/ear`. Renamed routes keep redirects; the shell owns navigation only.
- A graph belongs to the trace, not the tuner: a tuner's answer is one number, so both the instant spectrum and the time view live in `/trace`, where they are two readings of the same instant.
- Layout follows the tool's use: the tuning workbench shows many readouts at once (collapsible cards); the metronome, the trace and ear training each have one focus (a single stage that never scrolls).
- Where the settings go follows the same test — is the knob part of the loop? A metronome's meter is set once and then played, so it hides behind the value it changes (`ControlSheet`). A dB floor is set *while watching the picture*, so on a wide screen the trace lays every knob flat under the canvas and a smoke test keeps them above the fold. A phone has no room for both and gets the same component inside a sheet: one definition, two placements, never two copies.
- The primary action is never disabled. If sight-singing needs a microphone, pressing start acquires one; disabling the button until the user finds some other control is how a feature becomes "unusable" without a single error.
- Practice tools run the loop themselves. Answer, verdict, next question — without a click in between; a sung take counts itself in, judges itself and starts the next line. Automation is the default with an off switch, not a setting to find.
- Practice questions are not uniform random: a fair draw repeats (with two answers it repeats half the time) and spends as much time on what you know as on what you do not. Draws refuse an immediate repeat and lean towards what was recently missed.
- Feature layering is strict everywhere: `domain/` pure functions -> `engine/` scheduling and sound -> `stores/` -> UI. Audio is the master clock; Vue never triggers a sound, and the UI follows the audio clock through rAF.
- Features depend on the `Transport` interface, never on the native implementation. The scheduler is generic over its event — it reads only `delta` and `silent` — so a metronome bar and any other stream are scheduled by the same code. A phrase that is short and fully known (an ear-training question) is placed on the clock in one go instead; the look-ahead scheduler is for streams that never end.
- Metronome edits land on the next event, never the next bar: the cursor re-reads the live pattern and tempo per event, and the scheduler commits nothing beyond its horizon. Only bar length (meter) is snapshotted at the bar line, because changing it mid-bar destroys the count.
- `AnalysisPipeline` owns every analysis decision (cadence, YIN/spectral arbitration, smoothing, silence) and takes frames plus a clock; `audio/analysis.ts` is only the rAF + AnalyserNode adapter. Analysis behaviour is tested without a browser.
- Plots are part of the page, not a hole in it: the canvas paints its own surface from the same tokens, colour ramps come in a dark-page and a light-page family, and the default follows the theme. Axis labels are budgeted by the pixels available — colliding text reads as damage, not as detail.
- One number cannot serve two masters: the needle wants a smoothed pitch, a time series and a judge want the pitch as detected. The analysis snapshot carries both, and anything that plots or grades a moment reads the raw one.
- A view is one stream projected through one set of scales. `lib/plot/scale.ts` is the single source of "where does this value sit" — a scale maps a domain value to 0..1 and knows nothing about axes. Canvas colours come from the `--plot-*` tokens through `lib/plot/palette.ts`, never from a second hard-coded palette.
- History is a ring of columns stamped with audio time, and a view is a *query* over it — never a canvas scrolled one pixel per frame, which would tie the time axis to the frame rate and make freezing, zooming and replay impossible.
- Drawing pitch as a line has rules a heat map does not: break the line where the signal is unvoiced (joining across a breath draws a glissando nobody sang), and fold one-off octave errors back onto it (a real leap is held; an artefact lasts a frame).
- Everything enumerable is data, not code. Instruments, click banks, voices, exercise types, colour ramps: adding one must be a new row, not a new code path. If it is not, the abstraction is wrong.
- One tuning model: a preset is a list of `TuningTarget`s (label, positions, optional grid slot, optional fingering). Strings, tines, harmonica holes and wind fingerings differ only in data, so matching, selection and the needle exist once. A new instrument family adds a renderer (`list` / `grid` / `fingering`), never a second model.
- Adding an instrument ≈ adding one data file and registering it — never touch the UI or the analysis stream. The detector band is derived from the pitches the instrument can produce (`deriveRange`); only override `range` with a reason.
- Real-time analysis: canvases draw imperatively through `onFrame` and never enter Vue reactivity; display results update via shallowRef at analysis cadence; large subtrees sync change-only.
- Feature state lives in `features/*/stores/`, and importing a store must have no side effect: read persisted state in an explicit `hydrate*()` the view calls.
- Anything persisted goes through `lib/persist.ts` (`ml.` prefix, one declaration per value, legacy key migration) — never touch `localStorage` directly.
- Compatibility code carries an expiry. The `tcl-` key migration and the legacy hash-route mapping retire in v3.0; without a date, compatibility only accumulates.
- Single source for styles: the `.card` base rule owns the shell and padding; panel differences are variant classes (`card--wide` / `card--tall` / `card--stack` / `card--glow*`). Never duplicate definitions or leave dead overrides.

## Workflow
- Test-driven: write the failing test first, then the minimal change that makes it pass.
- Commit only when `npm test` is green and `vue-tsc --noEmit` is clean; use conventional prefixes (`feat:` / `fix:` / `refactor:` / `chore:`) with double-quoted `-m`.
- Three test layers, each with its own job: unit tests for logic (Node), `tests/components/` for component behaviour (happy-dom, mounts the real components), and `npm run smoke` for what only a browser answers — layout geometry, overflow, routing, i18n. Smoke starts its own dev server.
- UI changes must run `npm run smoke` (desktop + mobile viewports).
- Boundaries are enforced by the import graph and by grep over the source, not by convention: features never import each other, shared layers never import a feature, `lib/` never imports `audio/`, only `audio/` names Web Audio, and only the router names a feature view.
- Anything with randomness in it takes an injected random source, so a question, a practice pattern or a generated melody is reproducible in a test.
- A control whose label is its own current state is ambiguous — "Staff" could mean "you are reading a staff" or "switch to a staff". Choices are segmented with every option visible and the current one marked; only genuine on/off switches are single chips. Controls are grouped by the question they answer (what am I reading, what am I singing, what do I do now), not by what happens to be a toggle.
- The app never records its own voice. A reference tone, a count-in or a preview comes out of the speakers and back into the microphone; capture is held while the app is sounding, or the player's take contains the app.
- Register is a setting, not an error. A tenor sings a soprano's line an octave down and is right: everything that sounds, draws and grades follows the chosen register, while the written line stays where it was written.
- Sight-singing means reading: the line is written down as a staff or as numbered notation, laid out by pure functions in `lib/notation.ts`. A pitch plot shows what came out; it is not a score.
- Anything an rAF loop reads from the audio clock must be read *in the loop*. `AudioContext.currentTime` is not reactive, so a `computed` window is evaluated once — before the context exists — and the view then draws the same long-gone seconds forever. Pass a function, not a value.
- Progress can always be reset. A level earned on a bad microphone otherwise follows the learner forever.
- Features whose point is the round trip are tested through it. Sight-singing's smoke test installs an oscillator as the microphone, reads the written line off the page and performs it at tempo; the assertion is that an in-tune take scores. A browser's fake capture device cannot sing what is on the screen, and three real bugs lived exactly where nothing else could look.
- `package.json` is the single source of the version: the header renders it and the tracked `pre-push` hook tags `v<version>`. Bump it when releasing work.

## Data & i18n Correctness
- Instrument data (note tables / bend depths / ranges) is locked by per-note / per-hole tests; change the data, change the tests.
- Rhythm behaviour is locked the same way: meters, accents, subdivision/swing offsets, tempo maths and the scheduler have unit tests with an injected clock — no real AudioContext needed.
- Analysis and plotting are locked as pure functions: band reduction, ring-buffer windows, colour-ramp monotonicity, pitch-track segmentation, interval tables, exercise generation and sung-note verdicts all run in Node.
- The dictionary is split by owner (`lib/i18n/dictionaries/{shell,tuning,metronome,trace,ear}.ts`); each file keeps zh/en parity and no key is defined twice (enforced by tests).
- `t()` takes a typed `MessageKey`. A key built from a union (`tuner.kind.${kind}`) type-checks only if every member exists, so keep such sets closed (`SoundBankId`, `ChordTypeKey`, `ColormapId`, `IntervalKey`, `ExerciseKind`) rather than widening them to `string`.
