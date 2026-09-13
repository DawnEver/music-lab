---
name: sharp-review-2026-09-13
description: Sharp review findings — 27 total
metadata:
  type: project
---

## Review 2026-09-13 (session) — adversarial review (对抗性审查) + diff review

### Reviewer Status
- Reviewer claude (claude): OK
- Reviewer codex (codex): skipped
- Reviewer deepseek (deepseek): OK
- Reviewer gmi (gmi): skipped
- Reviewer kimi (kimi): skipped

### Confirmed findings

---

### [SR-20260913-001] [HIGH] src/styles/style.css:3822-3829 vs 3857-3873 — The phone rules that size a wind-chart card are dead: the later desktop rules override them, so on a phone every dizi card collapses to ~22px

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Move the two `.hole-chart.is-*/.hole-card` base rules above the media block, or scope them with `:not()`/raise the phone selector's specificity so the 72px minimum actually wins.

`.hole-chart.is-horizontal .hole-card` at 3822 sets `flex: 0 0 auto; min-width: 72px`, but the equal-specificity `.hole-chart.is-horizontal .hole-card` at 3857 (later in source, outside the media query) sets `flex: 1 1 0; min-width: 0`; same for `.hole-chart.is-vertical .hole-card` (3829 `min-height: 72px` vs 3870 `flex: 1 1 0; min-height: 0`). Measured in Chrome at 375x667: computed `min-width: 0px` / `min-height: 0px`, and a `.hole-card` renders 22x393 (horizontal) and 355x22 (vertical) against an intended >=72px tap target. In the vertical case the note name is not even inside the card (`headInside: false`). Before this commit the phone rule was `.hole-card { flex: 0 0 auto }` and the base `min-width: 62px` won, so the cards were 62px wide and the strip scrolled; the new rules silently removed both the size floor and the scroll (`scrollWidth 395` vs `clientWidth 355`). No assertion in smoke or unit tests measures a card's size, so this ships green.

---

### [SR-20260913-002] [HIGH] src/styles/style.css:3449-3457 — On a phone the vertical fretboard's fret rows shrink to 20px while their cells stay 30px, so every row's cells overflow 10px into the row below and the neck overlaps itself

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Give `.fret-row` a real minimum (`min-height: 30px`, i.e. the cell floor) so the board overflows and `overflow-y: auto` on `.fret-board.is-vertical` engages, instead of `min-height: 0` letting the rows shrink under their own content.

`.fret-row { flex: 1 1 0; min-height: 0 }` plus the removal of the phone `max-height: calc(100vh - 440px)` guard means 17 rows (heading + 16 frets) are squeezed into the 393px stage. Measured at 375x667: rows are 20px tall, `.fret-cell` computed `min-height: 30px`, each cell's bottom is 10px past its row's bottom (43% overlap), board `scrollHeight 402` vs `clientHeight 393` so the scroll container never scrolls. The comment added at 3578 ('Rows keep a hittable minimum, so a neck too long for the screen scrolls rather than shrinking into nothing') is exactly inverted: the rows have no minimum and the cells are what overflows. Same mechanism at 1280x520 gives 30px rows with 32px cells. Smoke passes because `assertNoVOverflow` only looks at the document and the new geometry assertions only measure the run axis.

---

### [SR-20260913-003] [MEDIUM] src/shared/components/ControlSheet.vue:51-59 — The open direction is decided by the anchor's top against a hardcoded viewport midpoint, ignoring where the sheet starts and how tall it is

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Decide from the room actually available: `below = innerHeight - box.bottom >= min(0.6 * innerHeight, 520)` (or measure the sheet after mount and flip), and recompute on resize.

The sheet is positioned at `top: calc(100% + 10px)` from the anchor and is up to `min(60vh, 520px)` tall, so the correct datum is `box.bottom` and the correct comparison is against the sheet's height, not `box.top < innerHeight / 2`. Measured: at 1024x640 the metronome's `meter` sheet (520px tall, chip in the lower half) opens upward with its top 144px above the viewport while the document can only scroll 79px, so 65px of it is unreachable — and a chip landing in the top half but below `0.4 * innerHeight` gets the mirror failure with the new rule. The doc comment claims 'moving a control to another part of the page cannot leave its editor off-screen'; nothing tests that invariant, and the one case this commit fixed (a chip in the top bar) is the only case it handles.

---

### [SR-20260913-004] [MEDIUM] src/styles/style.css:3870-3873 — `flex-direction: row-reverse` puts the wind chart's note name at the trailing edge, on the far side of a full-width card from its own fingering

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Use `flex-direction: row` (note first, holes after it) or cap the card's width so label and holes stay adjacent.

Measured on the desktop vertical dizi chart: the card is 1248px wide, `.hole-head` starts at x=1224 and `.hole-holes` at x=11 — the note name and the six dots it names are separated by the width of the page. The comment above the rule says 'the note first, the holes after it, the way the line itself now runs', which is the opposite of what `row-reverse` does in LTR (DOM-first item is placed at the main-axis end). The unit test only compares `aria-label` order, which a reversal cannot change.

---

### [SR-20260913-005] [MEDIUM] src/features/play/stores/play.ts:117-124 — The viewport-derived orientation default — written for a 16-fret neck — is now applied to every surface, so a phone's first visit opens on a vertical piano

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Keep the viewport heuristic per surface (neck: viewport-derived; keys: horizontal) or make the first-visit default horizontal everywhere and let the chip do the turning.

`NARROW_SCREEN_PX` exists because 'a sixteen-fret row gives cells too small to hit'; a keyboard has no such constraint, and turning it is not a rotation of a use case but a different instrument. Measured at 375x667 the default board is `kbd-board is-vertical`: 19 white keys of 355x34px (a 10:1 stripe, 646px of board inside 369px of stage, so half the keyboard is off-screen) and black keys 220x20. The stored-choice guard means this only bites first-time phone visitors, i.e. exactly the cohort no one on the team is. Make sure this is a decision and not an accident of reusing one field.

---

### [SR-20260913-006] [MEDIUM] scripts/smoke.mjs:462-495 — The new geometry assertions are one-dimensional, so they cannot see the two phone defects above, and they never check that a card is a tap target

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Assert the perpendicular axis too (`key.height` in horizontal, and a floor on `.hole-card`/`.fret-row` boxes), and assert that a `.fret-cell` fits inside its `.fret-row`.

`assertKeyIsHandSized` deliberately measures only the run axis, so a 1248x34px 'key' passes the 'both ends come from the hand' rule that the CSS states. `assertStageOwnsTheRest` proves the stage reaches the bottom of `main` but says nothing about whether the instrument inside it is usable, and `walkPlay` counts `.hole-card`/`.fret-row` nodes and checks the document does not scroll — none of which can see a 22px card or a 10px cell overlap. Every assertion added in this commit is satisfied by the two broken phone layouts measured above; the suite went from red-to-green on geometry it does not measure.

---

### [SR-20260913-007] [MEDIUM] src/features/play/stores/play.ts:73-94 — The one line that decides what every existing user sees on their next visit — the `fretOrientation` fallback — has no test

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Add a store test over `storedJson`'s reviver: `{ fretOrientation: 'vertical' }` -> `orientation: 'vertical'`, `{ orientation: 'sideways' }` -> `'horizontal'`, and `{}` -> the base.

`readOrientation(value.orientation ?? value.fretOrientation, base.orientation)` is the whole migration, and it is exercised by nothing: `tests/components/play.test.ts` mounts surfaces with the prop handed in, and the store itself has no unit test. Note also that a malformed-but-present `orientation` does *not* fall back to the legacy key, and the doc comment ('Anything that is not the one word "vertical" is the default') contradicts the body, which accepts two words and otherwise returns the `fallback` argument — small things, but in an untested function they are exactly the things that stay wrong.

---

### [SR-20260913-008] [LOW] src/styles/style.css:3614-3617 — The z-index tie was fixed by raising one number, which is the same class of bug the commit message identifies

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Let the sheet escape the tool's stacking context (teleport it) or define the layering with a named token, so nothing has to be numerically greater than a black key's 2.

The reusable insight in the memory entry is '同一个数值出现在两个地方,就一定会有一天打平'. The fix makes `.play-bar` `z-index: 5` against a black key's `2`, so the invariant is now 'the bar must exceed every surface's z-index' — an unstated rule a new surface can violate by picking 5 or 6. It works today; it will not survive the next surface.

---

### [SR-20260913-009] [LOW] src/styles/style.css:3415 — `.kbd-hint` is dead CSS after the hint moved to `.play-hint`

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Delete the rule.

The only remaining `.kbd-hint` in the repo is its own definition; `PlayView.vue:195` renders `.play-hint`.

---

### [SR-20260913-010] [LOW] src/styles/style.css:3685 — `justify-content: stretch` on `.play-stage` is not a valid flex value and does nothing

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Delete it (`flex: 1 1 auto` on the child is what actually fills the stage).

Box alignment defines `stretch` for `justify-content`, but for a flex container it computes to `flex-start`; the comment above the rule claims the stage hands the instrument the whole room, and this line reads as if it does that. It does not.

---

### [SR-20260913-011] [LOW] tests/audio-voice.test.ts:190-206 — The drum bug's new tests assert the implementation, not the behaviour that motivated the fix

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Add a case over the performer: strike a `hihat` with `choke: 'hihat'`, strike again, and assert the first voice was released.

The two new cases check `sources.length === 1` / `oscillators.length === 0` and that `release` stops the buffer source earlier than the note's own ring (a weak bound that the pre-fix sine would also have satisfied). The stated reason drums go through `hold()` at all — 'a choke group needs something to cut off' — is still untested for a noise voice, which is the only path `strike()` uses.

---

### [SR-20260913-012] [INFO] src/styles/style.css:3604-3618 — The new bar costs 114px — 17% — of a 375x667 phone and wraps to three lines, with nothing capping or measuring it

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Assert the bar's height on a phone the way the previous round asserted the chrome, or move the octave stepper back into the instrument.

Measured on mobile: `.play-bar` spans y=120..234 and the stage y=254..623. The commit that precedes this one was about taking room back from the chrome ('Chrome is space taken from the tool'); this one adds a picker, two orientation chips, an octave stepper and a hint above the instrument, and the only test on the bar counts its chips.

---

### [SR-20260913-013] [INFO] src/styles/style.css:362-365 — The layout silently depends on `PlayView` having exactly two root nodes

- **Category:** Bug
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Comment the coupling in `PlayView.vue` next to the template's two roots, or drop the explicit `grid-template-rows` and let `1fr` come from a wrapper.

`grid-template-rows: auto minmax(0, 1fr)` under `.dashboard:has(.play-stage)` has two explicit rows and maps them positionally to the bar and the stage. A third child (a conditional element, an `AudioSource`, a debug panel) creates an implicit auto row and the stage stops reaching the bottom; the failure shows up as `assertStageOwnsTheRest` with no hint of the cause.

---

### [SR-20260913-014] [INFO] src/features/play/components/DrumPads.vue:24-40 — The kit's vertical layout regroups by `column` and the test hardcodes the resulting piece order

- **Category:** Feature
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Assert the invariant (lines are vertical, every piece present, the metal above the drums within a line) rather than the literal `['crash','kick']` sequence.

`expect(...).toEqual(['crash','kick'])` in `tests/components/play.test.ts:252` pins the kit's data, so a change to `PIECES` fails a layout test for a data reason. Worth deciding deliberately: a real kit is two hands on two rows, and the turned layout puts the kick (a foot) directly under the crash; the smoke's 'lines have distinct x' assertion guards the collapse bug but not whether the transposed kit is something anyone would play.

---

### [SR-20260913-015] [HIGH] src/styles/style.css — The wind chart's mobile card sizes are dead: the @media rules at 3822/3827 are overridden by same-specificity rules at 3857/3870 that come later in the file, so on a phone the scale renders as 22px slivers.

- **Category:** layout-regression
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Move the four `.hole-chart.is-* .hole-card` rules into an explicit order — either put the mobile block after the un-media'd rules, or raise its specificity (e.g. scope the desktop rules to `@media (min-width: 721px)`), so `.hole-card` keeps `flex: 0 0 auto; min-width/min-height: 72px` on a phone. Then add the missing assertion (see the smoke finding) so the size is checked, not just the order.

`.hole-chart.is-horizontal .hole-card { flex: 0 0 auto; min-width: 72px }` (line 3822, inside `@media (max-width: 720px)` starting at 3801) loses to `.hole-chart.is-horizontal .hole-card { flex: 1 1 0; min-width: 0 }` at line 3857, which is outside the media query and therefore matches at every width. Same for 3827 vs 3870. Measured in Chrome at 375x667: phone dizi default (Down) gives `cardBox 355x22` with `cardMinHeight: "0px"` — the CSS intends 72px; pressing Across gives `cardBox 22x393` with `cardMinWidth: "0px"` — 14 cards 22px wide. The Across screenshot (taken during review) shows the note names and the "Overblow" key hints colliding into an unreadable smear, with the 6 dots spread over 343px of empty column. The rule comment right above the dead declarations ("a card keeps a size the thumb can hit") states the opposite of what the browser does. The default Down state is less broken but still 22px-tall tap targets with a 25px two-line head inside them (`.hole-head` is 25px, the border box is 22px, no `overflow: hidden` on `.hole-card`).

---

### [SR-20260913-016] [HIGH] src/styles/style.css — `.fret-row { min-height: 0 }` (line 3455) lets a neck shrink below its cells: on a phone the vertical fretboard's 16 fret rows collapse to 20px while their cells stay 30px, so every cell overflows its row by 10px and the tap target is 20px.

- **Category:** layout-regression
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Drop `min-height: 0` from `.fret-row` (a flex item's default `min-height: auto` is exactly the "automatic minimum size = content" the comment promises), or set `min-height: min-content`. Rows then take an equal share of the stage while there is room and the board scrolls when there is not, which is what `.fret-board.is-vertical { overflow-y: auto }` is already there for.

Measured at 375x667 with the guitar selected and turned Down: `.fret-row` heights `[17,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20]` against `.fret-cell` heights of 30 and `cellOverflow: 10` on all 16 rows. Stashing only `src/styles/style.css` and re-measuring the same page at HEAD gives rows of 30, `cellOverflow: 0`, and `board.scrollHeight 545 > clientHeight 227` — i.e. this is a regression introduced by this change, not a pre-existing one. The comment added at line 3547 ("Rows keep a hittable minimum, so a neck too long for the screen scrolls rather than shrinking into nothing") describes the behaviour the code no longer has. The `flex: 1 1 0` itself is fine and is what makes the desktop neck spread its 7 rows across the stage; it is only `min-height: 0` that removes the floor.

---

### [SR-20260913-017] [MEDIUM] src/styles/style.css — A turned keyboard's cross axis is unbounded: `.kbd-board.is-vertical { width: 100% }` (3336) and `.is-horizontal { height: 100% }` (3330) make a white key as long as the room is wide, so a 1280px desktop gets 1248x34px keys — 330mm, against the 23.5mm bound this codebase states for a white key.

- **Category:** design-invariant-violation
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Bound the cross axis the same way the run axis is bounded. The run axis already reads `clamp(whiteCount*9mm, 100%, whiteCount*23.5mm)`; the cross axis needs the key's *length* bound (a real white key is ~150mm / 567px) with the board centred when it is shorter and scrolled when longer — which is what the removed `clamp(150px, 22vh, 260px)` on `.kbd-keys` was doing by hand. Then widen `assertKeyIsHandSized` to assert both axes.

Measured: desktop (1280x900) piano turned Down → white key 1248x34, black 774x20; the horizontal board is 66x593, which is right (17.5mm wide, 157mm long). The stage hands the board its cross size, so the key's length is exactly the window's width: any wider display makes it worse, and there is no upper bound anywhere in the CSS. The screenshot of the turned desktop keyboard shows 19 full-width bars, black bars 62% of the way across, with the note names and the Z-M key caps jammed against the right edge so the two labels overlap (`-C4` at x≈1225). `assertKeyIsHandSized` cannot catch it: it deliberately measures `vertical ? box.height : box.width` — the run axis — so a 34px-tall, 1248px-wide key passes the 34-89px test by construction. Turning the keyboard is a supported, newly-added, first-class action; it should not be able to produce a key 14x wider than the bound the rest of the app is built on.

---

### [SR-20260913-018] [MEDIUM] src/features/play/stores/play.ts — The narrow-viewport default now applies to every surface although its rationale is fret-only, and it contradicts the hint copy: a phone's first visit gets a 90-degree-rotated piano while the hint still says "swipe sideways for more" / "drag across to slide".

- **Category:** interaction-design
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Derive the hint from `settings.orientation` rather than from the viewport alone (the dictionaries are keyed `playKeysHintTouch` / `playFretsHint` with no orientation variant — add one, or make the copy orientation-neutral). Separately, reconsider handing the viewport's advice to non-fretted surfaces: `NARROW_SCREEN_PX` was derived from "sixteen frets across 390px are not hittable", and a scrolling horizontal keyboard was the existing, working phone design.

`hydratePlay` (line 117) sets `settings.orientation = viewportWidth < NARROW_SCREEN_PX ? "vertical" : "horizontal"` for whatever instrument is loaded, so a first-time phone visitor opening `/play` sees the piano rotated: measured 355x34px white bands (screenshot during review), which is still playable but is not a keyboard. `hint` (PlayView.vue:78-82) branches only on `isKeys` and `narrow`, so in that default state it renders `playKeysHintTouch` — "Tap the keys; swipe sideways for more" (dictionaries/play.ts:39) — while the board's scroll axis is `overflow-y: auto; touch-action: pan-y`; the same holds for `playFretsHint` "drag across to slide" (line 40) on a Down neck. The old code chose the viewport default only for `fretOrientation`, where crossing 16 frets a phone-width really is the problem; generalising the field to `orientation` (correct in itself, and the rename/migration is clean) silently generalised the heuristic too.

---

### [SR-20260913-019] [MEDIUM] scripts/smoke.mjs — No new mobile assertion has ever run: the mobile walk aborts at the pre-existing `/trace` overflow before it reaches `/play`, and the /play checks added here are size-blind for the two things that are actually broken.

- **Category:** test-coverage
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Fix the pre-existing `/trace` regression first (it is out of scope for this diff, but it is the reason this diff is unverified on the phone), then add the missing assertions: a minimum card size for `.hole-card` in both orientations, and `cell.scrollHeight <= row.clientHeight` (or a minimum fret-cell height) for a phone neck. The `/play` walk should also assert the *default* orientation per viewport, since that is what a first-time phone user actually sees.

`npm run smoke` exits on `✗ mobile trace: page scrolls by 17px`; I reproduced it directly at 375x667 (`scrollHeight 684` vs `innerHeight 667`, `.shell` 684) and confirmed by stashing `src/styles/style.css` + `ControlSheet.vue` that it reproduces identically at HEAD, so it is not caused by this diff — but its consequence is. The desktop walk prints `✓ desktop: keys, frets, pads and holes all play, turn, and fill the page`; the mobile walk never gets there. The new assertions are all count- or order-based (`assertTurned`, `.kbd-key` count, `.pad` count, `.hole-card` aria-labels, `.pad-row` x-uniqueness), and `assertKeyIsHandSized` measures one axis on purpose — which is precisely why the 22px phone cards and the 20px fret rows above survived. The memory entry asserts the phone layout was verified by hand at six viewports, but that sweep checked width, the bottom gap and the key run-size, which is the same blind spot.

---

### [SR-20260913-020] [MEDIUM] src/features/play/PlayView.vue — The new bar costs more chrome than the rule allows: on a 667px phone with the default piano it is 114px (17% of the screen) in three wrapped rows, because the hint and the octave control each take a full row.

- **Category:** chrome-budget
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Make the hint yield instead of wrapping onto its own line (it is advice, not a control — the rule says the instrument's room is not negotiable), and consider letting the octave control share the row with the picker on a phone. `.play-hint`'s `flex: 1 1 180px` is what forces the third row; a smaller basis or `flex: 1 1 0; min-width: 0` would let it sit beside the chips the way `.topbar-actions` sits beside the brand.

Measured at 375x667: piano bar 114px tall with children at top 120 (chip 155px + orient chips 134px), 172 (octave, 188px) and 216 (hint, 355px = its own row); dizi 90px; drums 70px. The stage is 365px for the piano, so the chrome is 24% of the space the bar and stage together occupy. The project rule is explicit that on a phone the toggles ride beside the brand and the decorative kicker goes, and that "chrome is space taken from the tool" — the new bar adds a permanently visible segmented control plus the hint plus the octave control above the instrument, where the previous design put the orientation picker inside the ControlSheet and the octave inside the card.

---

### [SR-20260913-021] [LOW] src/styles/style.css — `.kbd-hint` (line 3415) is dead: the element was renamed `.play-hint` and moved into the bar, so this rule (text-align: center) matches nothing.

- **Category:** dead-code
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Delete the rule. The live `.play-hint` at 3610 already carries the colour, size and alignment.

`grep -rn kbd-hint src tests scripts` returns only this CSS declaration; no template emits the class any more. `.play-hint` is a separate rule introduced in the same change, so the leftover is not load-bearing.

---

### [SR-20260913-022] [LOW] src/styles/style.css — `.orient-chip { min-height: 30px }` (line 3649) gives the primary layout control a 30px touch target on the device where it matters most.

- **Category:** accessibility
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Raise it to match `.value-chip`'s `min-height: 42px` (or the 44px convention), at least inside the phone breakpoint.

The chip sits in the bar next to a `.value-chip` that is 42px tall, so the two hit targets in the same row differ by 12px for no stated reason. The bar is the only place this control exists — it was removed from `PlayControl.vue` (the `isFretted` block and `ORIENTATIONS` are gone), so on a phone the only way to turn an instrument is this 30px button.

---

### [SR-20260913-023] [LOW] src/features/play/PlayView.vue — `aria-pressed` on two buttons in a `role="group"` mis-describes a one-of-two choice.

- **Category:** accessibility
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Use `role="radiogroup"` with `role="radio"`/`aria-checked`, or a `<fieldset>` of radios — mutually exclusive options are not independent toggles, and `aria-pressed` tells a screen reader both can be on.

Lines 160-173: the wrapper is `role="group"` with `aria-label`, and each button carries `aria-pressed`. The visual affordance (`.orient-chip.is-active`) is mutual exclusion; the semantics are not. The label is good (`playOrientation`) and the visible text is orientation-neutral in both languages, so only the role pairing needs changing.

---

### [SR-20260913-024] [LOW] src/styles/style.css — The desktop vertical wind card is 37px tall but its two-line head needs 41px, so the note label paints outside the card's border.

- **Category:** layout
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Either hide the degree line (`.hole-degree`) when the card is short, or let the vertical card grow to its content and scroll — `.hole-head` is `flex: 0 0 auto` and 25px, so the card needs `min-height: 25px + 16px` of padding at minimum.

Measured at 1280x900, dizi turned Down: `cardBox 1248x37`, `.hole-head 13x25`, `.hole-card` padding 8px 10px with `align-items: center`. 25 + 16 = 41 > 37, and `.hole-card` has no `overflow: hidden`, so the label bleeds through the top and bottom border by ~2px each. 14 rows of only-just-fitting text is the visible cost of `flex: 1 1 0` on a stage that is now 593px tall.

---

### [SR-20260913-025] [LOW] src/styles/style.css — `.hole-chart.is-vertical .hole-card { flex-direction: row-reverse }` (line 3864) contradicts the comment directly above it: the note head is the first DOM child, and `row-reverse` puts it last on screen.

- **Category:** comment-inaccuracy
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Confirm the intent. If the card is meant to read as the horizontal card rotated 90 degrees clockwise (head to the right, holes running to the left), keep `row-reverse` and fix the comment to say so; if the note is meant to come first, use `row`.

The template order is `.hole-head`, `.hole-holes`, `.hole-key` (HoleChart.vue:64-83). With `row-reverse` and `.hole-holes { flex: 1 1 auto }` the head lands at the far right, which the review screenshot confirms (note names right-aligned down the page, "Overblow" hints left). The comment claims "the note first, the holes after it". This only matters because the same change is otherwise careful to state the geometry it wants.

---

### [SR-20260913-026] [LOW] src/features/play/stores/play.ts — The `fretOrientation` -> `orientation` compatibility read has no stated expiry, unlike the other compat code in this repo.

- **Category:** technical-debt
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** Add the retirement to the same place the `tcl-` keys and the legacy hash-route mapping are tracked (the AGENTS.md compat note and the v3.0 line), so this third entry is not the one that gets forgotten.

Lines 82-89 read `value.orientation ?? value.fretOrientation` and comment "Read it, then it is gone" — but the code that reads it stays forever, and `persist()` writing `{...settings}` means the old key is dropped only when the player changes something. The convention stated in AGENTS.md ("Compatibility code carries an expiry: the `tcl-` keys and the legacy hash-route mapping retire in v3.0") is what makes this an omission rather than a choice.

---

### [SR-20260913-027] [LOW] src/features/play/stores/play.ts — The diff was committed while this review was running, so the "uncommitted working tree" under review no longer exists.

- **Category:** process
- **Status:** OPEN
- **Confidence:** single-reviewer
- **Suggestion:** If the review was meant to gate the change, run it against the diff before committing; if these findings are to be acted on, note that line numbers cited here refer to `ee071cf`'s tree, which is what was measured.

`git status --porcelain` was non-empty when the review started (14 modified files, plus an untracked `.claude/memory/2026/09/13/`); it is now clean and the content landed as `89f07aa` (fix(audio): sound a held noise voice as noise, not as a sine) and `ee071cf` (fix(ui): let the play tool own the page, and turn every surface). Every measurement above was taken against the on-disk files through the dev server and re-checked after the commits, so the evidence applies to `ee071cf` exactly; only the requested "range HEAD" framing is now stale.
