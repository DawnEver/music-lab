---
name: sharp-review-2026-08-30
description: Sharp review findings — 5 total
metadata:
  type: project
---

## Review 2026-08-30 (session) — diff review + architecture survey (架构锐评)

### Reviewer Status
- Reviewer claude (claude): OK
- Reviewer codex (codex): OK
- Reviewer deepseek (deepseek): skipped
- Reviewer gmi (gmi): skipped
- Reviewer kimi (kimi): skipped

### Confirmed findings

---

### [SR-20260830-001] [MEDIUM] src/router/index.ts — Switching from hash history silently breaks all existing metronome bookmarks

- **Category:** Bug
- **Status:** FIXED
- **Confidence:** single-reviewer
- **Suggestion:** Migrate known legacy fragments to clean paths before router startup and test them.

With createWebHistory, /#/metronome resolves pathname / and redirects to /tuning, leaving the old fragment inert.

---

### [SR-20260830-002] [LOW] index.html — A root-only canonical URL makes every tool route canonicalize to the homepage

- **Category:** Feature
- **Status:** FIXED
- **Confidence:** single-reviewer
- **Suggestion:** Set canonical dynamically from resolved tool route.

The SPA index emits the root canonical on direct tool routes, potentially treating distinct tools as duplicate homepage content.

---

### [SR-20260830-003] [HIGH] src/features/tuning/components/SourceBar.vue:37 — Leaving /tuning does not stop its microphone/file session or analysis loop

- **Category:** Bug
- **Status:** FIXED
- **Confidence:** single-reviewer
- **Suggestion:** Stop tuning audio from a feature-level onBeforeUnmount and test cleanup on route navigation.

SourceBar only clears hostContainer; stream, nodes, rAF, audio element and audio lease can remain active after navigating away.

---

### [SR-20260830-004] [MEDIUM] src/composables/useToast.ts:5 — Shared application layers depend on the tuning feature, defeating route isolation and lazy loading

- **Category:** Performance
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Move generic toast state to shared and tuning lifecycle wiring into the tuning feature.

AppShell and main eagerly import tuning stores through generic composables, reversing intended dependency direction.

---

### [SR-20260830-005] [MEDIUM] src/lib/dsp.ts:1 — Several modules exceed the 300-line cohesion threshold and combine independently evolving responsibilities

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Split DSP, analysis loop, tuning audio store, and key tracking into cohesive modules.

dsp.ts is 496 lines, tuning audio store 361, analysis-loop 326, key.ts 307, increasing testing and coupling pressure.
