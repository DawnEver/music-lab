# Development Principles

## Language & Terminology
- Write code and file contents in English; conversations may be in Chinese.
- UI copy lives in the i18n dictionary. Chinese UI text uses 调音 (tuning) consistently — never 校音.

## Architecture
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
- The zh and en dictionaries must define the same key set, and every static `t()` key referenced in `src` must exist in the dictionary (both enforced by tests).
