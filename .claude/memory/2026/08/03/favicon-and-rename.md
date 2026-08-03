---
name: favicon-and-rename
description: Added a local single-note favicon and renamed project to 调音实验室 / Tuning Lab
metadata:
  type: project
---

## 2026-08-03 — local favicon + project rename

### What changed
- **Favicon**: replaced the CDN reference (`cdn.mingyangbao.site/logo-latest/favicon.ico`)
  with a local `favicon.ico` + `favicon.png`. The user provided a reference icon (a black
  single eighth-note on light background) and required **pixel-perfect alignment** with it
  (99.5% achieved, MAE 0.005 via contour tracing). The user then asked to **rebuild with
  smooth spline curves**: the contour was decimated to 60 key points and fitted with a
  **closed cubic B-spline** (`scipy.splprep`, per=True, s=48) — **23 control points**, C²-
  smooth, baked into `note_spline.npz` (1KB). The reference image is no longer needed
  (deleted). **Final look**: the note in the site's blue→teal gradient
  (`#7c9cff → #5eead4`) on the **dark rounded-square background** (`#0d1324 → #080c18`),
  fills ~56% × 88% of the canvas, 4x supersample + LANCZOS anti-aliased. Multi-size ICO
  (16/32/48/64/128/256) + 2048px PNG master. `index.html` references `href="favicon.ico"`.
- **Generation script**: `.claude/memory/2026/08/03/gen_favicon.py` (samples the spline
  with `scipy.splev` at render time; needs scipy). To regenerate:
  `python .claude/memory/2026/08/03/gen_favicon.py .`
- **Rename to 调音实验室 · Tuning Lab**: updated `js/i18n.js` (zh+en appTitle + copyrights),
  `index.html` (title/h1/copyright defaults), `README.md` title, `package.json` description,
  `js/app.js` header comment. Kept `window.ToneChordLab` public API name unchanged. Updated
  `test/i18n.test.js` assertions to match.

### Validation
- All 24 tests pass (`npm test`).
- Sharp review ran: 1 LOW issue (favicon.ico local ref, not yet committed) → `sharp-review.md`.

### Reusable insight
- Icon style preference: **dark rounded-box + accent-gradient** (user rejected box-free/light
  variants: "原来颜色很好"). The user demands **pixel-perfect shape alignment** with a
  provided reference AND **maximally smooth lines** — the working recipe: trace the reference
  contour → Chaikin-smooth to the spline limit → bake to .npy → supersample-render. Iterating
  by re-drawing shapes geometrically failed repeatedly (user: "音符形状还是错误的"); tracing
  the reference itself is the reliable path. Also: PIL ellipse rotate/paste distort at scale —
  use analytic math; LANCZOS on binary masks rings — use NEAREST for comparisons.
