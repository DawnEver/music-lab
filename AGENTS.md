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
- Keep pure logic (DSP / instrument data / chords) as framework-agnostic pure functions directly testable in Node.
- Adding an instrument ≈ adding one data file and registering it — never touch the UI or the analysis loop.
- Real-time analysis: the spectrum is drawn imperatively and never enters Vue reactivity; display results update via shallowRef at analysis cadence; large subtrees sync change-only.
- Single source for styles: the `.card` base rule owns the shell and padding; panel differences are variant classes (`card--wide` / `card--tall` / `card--stack` / `card--glow*`). Never duplicate definitions or leave dead overrides.

## Workflow
- Test-driven: write the failing test first, then the minimal change that makes it pass.
- Commit only when `npm test` is green and `vue-tsc --noEmit` is clean; use conventional prefixes (`feat:` / `fix:` / `refactor:` / `chore:`) with double-quoted `-m`.
- UI changes must run `npm run smoke` (desktop + mobile viewports), which guards against regressions (content inside card padding, collapse unmounts content and badges, no horizontal overflow).

## Data & i18n Correctness
- Instrument data (note tables / bend depths / ranges) is locked by per-note / per-hole tests; change the data, change the tests.
- Rhythm behaviour is locked the same way: meters, accents, subdivision/swing offsets, tempo maths and the scheduler have unit tests with an injected clock — no real AudioContext needed.
- The zh and en dictionaries must define the same key set, and every static `t()` key referenced in `src` must exist in the dictionary (both enforced by tests).
