# Development Principles

## Language & Terminology
- Write code and file contents in English; conversations may be in Chinese.
- UI copy lives in the i18n dictionary. Chinese UI text uses 调音 (tuning) consistently — never 校音.

## Architecture
- One AudioContext for the whole app: features take a lease from `src/audio/audio-engine.ts` and never construct or close a context themselves.
- One tool per route under `src/features/*`; the shell owns navigation only. Tool-specific chrome (the audio source bar) lives in the tool, not the shell.
- Layout follows the tool's use: the tuning workbench shows many readouts at once (collapsible cards), the metronome has one focus (a single stage that never scrolls). Metronome settings are reached by tapping the value they change (`ControlSheet`) — never by adding another panel.
- Metronome edits land on the next event, never the next bar: the cursor re-reads the live pattern and tempo per event, and the scheduler commits nothing beyond its horizon. Only bar length (meter) is snapshotted at the bar line, because changing it mid-bar destroys the count.
- Metronome layering is strict: `domain/` pure functions -> `engine/` scheduling and sound -> `stores/` -> UI. Audio is the master clock; Vue never triggers a sound, and the UI follows the audio clock through rAF.
- The metronome depends on the `Transport` interface, never on the native implementation, so a Tone.js transport can replace it without touching a feature.
- Tuning is layered the same way: `AnalysisPipeline` owns every analysis decision (cadence, YIN/spectral arbitration, smoothing, silence) and takes frames plus a clock; `analysis-loop.ts` is only the rAF + AnalyserNode adapter. Analysis behaviour is tested without a browser.
- Keep pure logic (DSP / instrument data / chords) as framework-agnostic pure functions directly testable in Node.
- One tuning model: a preset is a list of `TuningTarget`s (label, positions, optional grid slot). Strings, tines and harmonica holes differ only in data, so matching, selection and the needle exist once — never add a parallel path for an instrument.
- Adding an instrument ≈ adding one data file and registering it — never touch the UI or the analysis loop. The detector band is derived from the pitches the instrument can produce (`deriveRange`); only override `range` with a reason.
- Real-time analysis: the spectrum is drawn imperatively and never enters Vue reactivity; display results update via shallowRef at analysis cadence; large subtrees sync change-only.
- Feature state lives in `features/*/stores/`, and importing a store must have no side effect: read persisted state in an explicit `hydrate*()` the view calls.
- Anything persisted goes through `lib/persist.ts` (`ml.` prefix, one declaration per value, legacy key migration) — never touch `localStorage` directly.
- Single source for styles: the `.card` base rule owns the shell and padding; panel differences are variant classes (`card--wide` / `card--tall` / `card--stack` / `card--glow*`). Never duplicate definitions or leave dead overrides.

## Workflow
- Test-driven: write the failing test first, then the minimal change that makes it pass.
- Commit only when `npm test` is green and `vue-tsc --noEmit` is clean; use conventional prefixes (`feat:` / `fix:` / `refactor:` / `chore:`) with double-quoted `-m`.
- Three test layers, each with its own job: unit tests for logic (Node), `tests/components/` for component behaviour (happy-dom, mounts the real components), and `npm run smoke` for what only a browser answers — layout geometry, overflow, routing, i18n. Smoke starts its own dev server.
- UI changes must run `npm run smoke` (desktop + mobile viewports).
- Boundaries are enforced by the import graph, not by convention: features never import each other, shared layers never import a feature, and only the router names a feature view.
- `package.json` is the single source of the version: the header renders it and the tracked `pre-push` hook tags `v<version>`. Bump it when releasing work.

## Data & i18n Correctness
- Instrument data (note tables / bend depths / ranges) is locked by per-note / per-hole tests; change the data, change the tests.
- Rhythm behaviour is locked the same way: meters, accents, subdivision/swing offsets, tempo maths and the scheduler have unit tests with an injected clock — no real AudioContext needed.
- The dictionary is split by owner (`lib/i18n/dictionaries/{shell,tuning,metronome}.ts`); each file keeps zh/en parity and no key is defined twice (enforced by tests).
- `t()` takes a typed `MessageKey`. A key built from a union (`tuner.kind.${kind}`) type-checks only if every member exists, so keep such sets closed (`SoundBankId`, `ChordTypeKey`, `Breath`) rather than widening them to `string`.
