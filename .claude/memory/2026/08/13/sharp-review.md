---
name: sharp-review-2026-08-13
description: Sharp review findings — 12 total
metadata:
  type: project
---

## Review 2026-08-13 (session) — architecture survey (架构锐评) + diff review

### Reviewer Status
- Reviewer claude (claude): skipped
- Reviewer codex (codex): OK
- Reviewer deepseek (deepseek): FAILED
- Reviewer kimi (kimi): skipped
- Warning: only 1/2 reviewers succeeded

### Confirmed findings

---

### [SR-20260813-001] [HIGH] src/lib/analysis-loop.ts — Auto-estimated key survives silence indefinitely.

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Reset KeyTracker and keyEstimateRef after a defined silence timeout, and add integration tests for silence and restart behavior.

clearAfterSilence() clears pitch and chord state but not key state. Pushing zero chroma only scales the accumulated vector down, while Pearson correlation is scale-invariant, so KeyTracker.estimate() can keep returning the held key forever.

---

### [SR-20260813-002] [HIGH] src/lib/analysis-loop.ts — The framework-agnostic lib boundary is violated by the central runtime module.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Split a pure frame-analysis/session state machine into lib, move rAF/Web Audio/Canvas orchestration into a browser service, and put Vue refs in a store or composable adapter.

This module imports Vue shallowRef, owns browser animation and analyser state, invokes Canvas drawing, performs smoothing, and coordinates pitch, chord, and key policies. It is neither framework-agnostic nor directly Node-testable, contrary to the documented architecture.

---

### [SR-20260813-003] [HIGH] src/composables/useTuner.ts — The auto-detect toggle is cosmetic; automatic target selection continues when it is disabled.

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Gate inferred matching and target assignment on autoMode, keep manual and inferred selections as distinct state, and test disabling auto detection while audio is active.

The pitchRef watcher never reads autoMode and always writes activeString or activeCell. needleTarget then consumes those values; components use autoMode mainly to control highlighting, not behavior.

---

### [SR-20260813-004] [HIGH] src/styles/style.css — The 1,526-line global stylesheet is an architectural monolith and exceeds the mandatory split threshold.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Split styles by tokens, base/layout, card system, tuner/instrument components, and responsive behavior while retaining exactly one .card base owner.

Unrelated shell, card, tuner, harmonica, responsive, and collapse rules share one unscoped file. This scale makes selector collisions, ordering dependencies, and dead overrides increasingly difficult to detect.

---

### [SR-20260813-005] [MEDIUM] src/stores/audio.ts — The audio store is a 360-line god module with poor cohesion.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Separate the non-reactive audio-session service from reactive UI state, move toast and key preferences to dedicated stores, and expose structured status/error results rather than translating inside infrastructure.

One module owns UI state, key selection, toast timers, localization, device discovery, DOM audio elements, object URLs, Web Audio graph lifecycle, error presentation, and analysis-loop startup. These concerns cannot be tested or evolved independently.

---

### [SR-20260813-006] [MEDIUM] src/stores/audio.ts — A store imports a UI composable, reversing the intended dependency direction.

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Import the framework-neutral i18n module directly, or return message keys from the audio service and translate at the UI boundary.

stores/audio.ts imports t from composables/useI18n.ts, while UI composables and components import the audio store. There is no literal cycle today, but the dependency makes the store sensitive to UI-layer evolution and creates an obvious future cycle hazard.

---

### [SR-20260813-007] [MEDIUM] src/lib/key.ts — Key estimation, temporal tracking, and harmonic-degree notation are fused into one module.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Split key/mode data, degree labeling, estimator profiles, and temporal tracking; make tracker half-life, margin, and vote thresholds configurable.

The 307-line file combines unrelated consumers and change reasons: notation tables and formatting, Krumhansl correlation, and a mutable hysteresis tracker. Adding modes or alternative estimators will compound this coupling.

---

### [SR-20260813-008] [MEDIUM] src/lib/dsp.ts — DSP is already a 496-line catch-all rather than a cohesive pure-logic package.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Extract numeric utilities, YIN analysis, spectral peak operations, and chroma/dominant-pitch analysis into focused modules; use an explicit reusable workspace if allocation avoidance is required.

Range resolution, generic math, RMS/YIN, peak interpolation, chroma construction, and spectral candidate scoring are bundled together. chord.ts and draw.ts consequently depend on the broad DSP module merely for clamp, and the module-level YIN buffer makes the nominally pure module stateful and non-reentrant.

---

### [SR-20260813-009] [MEDIUM] src/lib/analysis-loop.ts — The real-time loop violates its own change-only reactivity contract.

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Track a dirty flag and publish refs/ticks only after an analysis result or silence transition actually changes display state; add cadence assertions.

pitchRef.value = latestPitch and tickRef.value += 1 execute on every animation frame, including frames where neither the 88 ms pitch pass nor 105 ms spectrum pass ran. The module comment claims tickRef changes only when display-relevant values change, so large watchers can be triggered at roughly 60 Hz unnecessarily.

---

### [SR-20260813-010] [MEDIUM] src/instruments/index.ts — Instrument extensibility is data-driven only within two hard-coded UI layout families.

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Either narrow the documented promise to supported layouts or introduce layout/matching adapters and a renderer registry so new instrument families do not require composable and UI branching.

Every instrument still requires a manual import and registry edit, while useTuner, StringsPanel, and HarmonicaPanel explicitly branch between strings and harmonica. Another instrument using those layouts is cheap; a genuinely new interaction model requires changes across analysis-facing composable and UI code.

---

### [SR-20260813-011] [LOW] src/main.ts — The legacy Window API is a parallel public surface with no clear ownership or versioning.

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Remove or formally deprecate it, or derive it from a deliberate public barrel with contract tests and a documented compatibility policy.

The entry point manually curates window.ToneChordLab, while src/types/global.d.ts duplicates its signature. New pure capabilities such as key estimation are absent, making drift between the library and advertised browser API likely.

---

### [SR-20260813-012] [LOW] src/composables/useAnalysis.ts — The analysis composable is a pass-through facade that exposes mutable runtime internals.

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Expose readonly result refs and explicit registerSpectrumTarget/unregisterSpectrumTarget operations from an adapter or store.

Consumers receive the original mutable refs and the raw shared spectrumTargets Set owned by analysis-loop. The facade establishes no enforceable boundary, and any consumer can mutate central runtime state.
