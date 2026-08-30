/**
 * Headless smoke test: boots the app in a system Chromium browser and walks
 * both tools (tuning workbench + metronome) on BOTH desktop and mobile viewports — collapsible panels,
 * horizontal tuner layout, instrument switching, harmonica positions,
 * i18n, and horizontal-overflow checks. Captures console/page errors.
 * Run:  npm run dev   then   node scripts/smoke.mjs
 */

import { chromium } from "playwright-core";

const BASE_URL = process.env.SMOKE_URL ?? "http://localhost:5199";

// playwright-core ships no browsers, so we drive a system-installed one.
// Chrome by default; override with SMOKE_BROWSER=msedge on machines that
// only have Edge.
const CHANNEL = process.env.SMOKE_BROWSER ?? "chrome";

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const errors = [];

function attachListeners(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${label}][console] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${label}][pageerror] ${String(error)}`));
}

/** No horizontal overflow (scrollWidth <= innerWidth) is a key mobile check. */
async function assertNoHOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 1) throw new Error(`${label}: horizontal overflow of ${overflow}px`);
}

/** Every tool page is reached through the shell nav, never a deep link only. */
async function gotoTool(page, tool) {
  await page.click(`[data-tool-link="${tool}"]`);
  await page.waitForSelector(`[data-tool="${tool}"]`, { timeout: 8000 });
  const expectedPath = tool === "tuning" ? "/tuning" : "/metronome";
  const pathname = new URL(page.url()).pathname;
  if (pathname !== expectedPath) {
    throw new Error(`${tool}: expected clean route ${expectedPath}, got ${pathname}`);
  }
}

async function walkMetronome(page, label, { expectSingleScreen = false } = {}) {
  await gotoTool(page, "metronome");

  const pulses = await page.locator(".metro-beat").count();
  if (pulses !== 4) throw new Error(`${label}: expected a 4/4 grid, got ${pulses} beats`);

  // Everything a player needs while playing is on one screen: no panels,
  // no scrolling to reach the tempo or the play button.
  if ((await page.locator(".card").count()) !== 1) {
    throw new Error(`${label}: the metronome should be a single stage, not a stack of cards`);
  }
  if (expectSingleScreen) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    if (overflow > 1) throw new Error(`${label}: metronome should fit one screen (${overflow}px over)`);
  }
  console.log(`✓ ${label}: metronome is one screen with no panels`);

  // Tapping a value opens exactly the editor for that value.
  await page.click('[data-sheet="meter"] .value-chip');
  await page.waitForSelector('[data-sheet="meter"] .sheet', { timeout: 5000 });
  await page.click('.sheet .metro-chip:text-is("7/8 (2+2+3)")');
  await page.waitForTimeout(150);
  if ((await page.locator(".metro-beat").count()) !== 7) {
    throw new Error(`${label}: 7/8 should render 7 beats`);
  }
  if ((await page.locator(".metro-group").count()) !== 3) {
    throw new Error(`${label}: 7/8 (2+2+3) should render 3 groups`);
  }
  const chipValue = await page.locator('[data-sheet="meter"] .value-chip-value').textContent();
  if (!chipValue.includes("7/8")) throw new Error(`${label}: the chip should show 7/8, got ${chipValue}`);

  // Custom additive grouping, inside the same sheet.
  await page.fill(".sheet .metro-input", "3+2+2");
  await page.click(".sheet .metro-groups-row .metro-chip.is-action");
  await page.waitForTimeout(150);
  if ((await page.locator(".metro-beat").count()) !== 7) {
    throw new Error(`${label}: custom grouping 3+2+2 should render 7 beats`);
  }

  // Escape closes the sheet; only one sheet is ever open.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  if ((await page.locator(".sheet").count()) !== 0) {
    throw new Error(`${label}: Escape should close the sheet`);
  }
  await page.click('[data-sheet="feel"] .value-chip');
  await page.waitForSelector('[data-sheet="feel"] .sheet', { timeout: 5000 });
  if (expectSingleScreen) {
    // Desktop popovers are non-modal: another chip is one click away and
    // takes over the single open slot.
    await page.click('[data-sheet="sound"] .value-chip');
    await page.waitForTimeout(150);
    if ((await page.locator(".sheet").count()) !== 1) {
      throw new Error(`${label}: opening a sheet should close the previous one`);
    }
    await page.keyboard.press("Escape");
  } else {
    // Mobile sheets are modal: the backdrop is what dismisses them.
    await page.locator(".sheet-backdrop").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(150);
    if ((await page.locator(".sheet").count()) !== 0) {
      throw new Error(`${label}: tapping the backdrop should close the bottom sheet`);
    }
  }
  console.log(`✓ ${label}: value chips open their own editor (7/8, 3+2+2, one at a time)`);

  // The BPM readout is itself the tempo control.
  const before = await page.locator(".metro-bpm-value").inputValue();
  await page.click(".metro-step >> nth=1");
  await page.waitForTimeout(120);
  const after = await page.locator(".metro-bpm-value").inputValue();
  if (Number(after) !== Number(before) + 1) {
    throw new Error(`${label}: + should nudge the tempo (${before} -> ${after})`);
  }
  // The number is a field: typing a tempo is the most direct input there is.
  await page.fill(".metro-bpm-value", "96");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  if ((await page.locator(".metro-bpm-value").inputValue()) !== "96") {
    throw new Error(`${label}: typing into the BPM field should set the tempo`);
  }
  // Out-of-range input is clamped, not accepted.
  await page.fill(".metro-bpm-value", "999");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  if ((await page.locator(".metro-bpm-value").inputValue()) !== "400") {
    throw new Error(`${label}: an out-of-range tempo should clamp to 400`);
  }
  await page.fill(".metro-bpm-value", "120");
  await page.keyboard.press("Enter");

  await page.click(".metro-bpm-unit");
  await page.waitForSelector('[data-sheet="tempo"] .sheet', { timeout: 5000 });
  await page.keyboard.press("Escape");
  console.log(`✓ ${label}: the BPM readout accepts typing, nudges, and opens the tempo editor`);

  // Clicking a beat cycles its accent.
  const beatBefore = await page.locator(".metro-beat").nth(1).getAttribute("class");
  await page.locator(".metro-beat").nth(1).click();
  await page.waitForTimeout(120);
  const beatAfter = await page.locator(".metro-beat").nth(1).getAttribute("class");
  if (beatBefore === beatAfter) throw new Error(`${label}: clicking a beat should cycle its accent`);
  console.log(`✓ ${label}: beat click edits the accent`);

  // Start/stop drives the audio clock and the running highlight.
  await page.click(".metro-play");
  await page.waitForSelector(".metro-play.is-running", { timeout: 5000 });
  await page.waitForSelector(".metro-beat.is-active", { timeout: 5000 });
  await page.click(".metro-play");
  await page.waitForTimeout(200);
  if ((await page.locator(".metro-play.is-running").count()) !== 0) {
    throw new Error(`${label}: metronome should stop`);
  }
  // Space is the shortcut a player actually uses.
  await page.keyboard.press("Space");
  await page.waitForSelector(".metro-play.is-running", { timeout: 5000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  if ((await page.locator(".metro-play.is-running").count()) !== 0) {
    throw new Error(`${label}: Space should stop the metronome`);
  }
  console.log(`✓ ${label}: transport starts, highlights beats, and stops (click + Space)`);

  // The mic picker must not follow the user into the metronome.
  if ((await page.locator(".source-actions").count()) !== 0) {
    throw new Error(`${label}: the audio source bar should stay in the tuning tool`);
  }

  await assertNoHOverflow(page, `${label} metronome`);
  await gotoTool(page, "tuning");
}

async function walkWorkbench(page, label) {
  // All five panels render.
  await page.waitForSelector(".strings-panel", { timeout: 8000 });
  await page.waitForSelector('[data-panel="pitch"]', { timeout: 8000 });
  await page.waitForSelector('[data-panel="chord"]', { timeout: 8000 });
  await page.waitForSelector('[data-panel="spectrum"] .spectrum-wrap canvas', { timeout: 8000 });
  await page.waitForSelector('[data-panel="settings"] .v-slider', { timeout: 8000 });
  console.log(`✓ ${label}: workbench renders all 5 panels`);

  // Panel content must stay inside the card padding — overflow: hidden
  // would otherwise clip text at the rounded corners (regression guard).
  const insets = await page.evaluate(() => {
    const results = [];
    for (const card of document.querySelectorAll(".card")) {
      const cardRect = card.getBoundingClientRect();
      const body = card.querySelector(".panel-body") ?? card.querySelector(".card-toggle");
      const rect = body.getBoundingClientRect();
      results.push({
        panel: card.dataset.panel ?? "?",
        insetTop: rect.top - cardRect.top,
        insetBottom: cardRect.bottom - rect.bottom
      });
    }
    return results;
  });
  for (const inset of insets) {
    if (inset.insetTop < 18 || inset.insetBottom < 18) {
      throw new Error(
        `${label}: panel "${inset.panel}" content escapes the card padding ` +
          `(top ${Math.round(inset.insetTop)}px / bottom ${Math.round(inset.insetBottom)}px) — ` +
          "it would be clipped by the rounded corners"
      );
    }
  }
  console.log(`✓ ${label}: all panels keep content inside the card padding`);

  // Collapsing a panel unmounts its content AND its header badge
  // (waiting / 0% match / FFT meta are content state, not titles).
  await page.click('[data-panel="pitch"] .card-toggle');
  await page.waitForTimeout(250);
  if ((await page.locator('[data-panel="pitch"] .micro-badge').count()) !== 0) {
    throw new Error(`${label}: pitch badge should hide when the panel collapses`);
  }
  await page.click('[data-panel="pitch"] .card-toggle');
  await page.waitForSelector('[data-panel="pitch"] .micro-badge', { timeout: 5000 });
  await page.click('[data-panel="spectrum"] .card-toggle');
  await page.waitForTimeout(250);
  if ((await page.locator('[data-panel="spectrum"] canvas').count()) !== 0) {
    throw new Error(`${label}: collapsed spectrum canvas did not unmount`);
  }
  if ((await page.locator('[data-panel="spectrum"] .spectrum-meta').count()) !== 0) {
    throw new Error(`${label}: spectrum meta should hide when the panel collapses`);
  }
  await page.click('[data-panel="spectrum"] .card-toggle');
  await page.waitForSelector('[data-panel="spectrum"] canvas', { timeout: 5000 });
  console.log(`✓ ${label}: collapse hides content and header badges`);

  // Guitar: 6 string cards in a multi-column grid.
  const guitarCards = await page.locator(".string-row").count();
  if (guitarCards !== 6) throw new Error(`${label}: expected 6 guitar strings, got ${guitarCards}`);
  const [card0, card1] = await page.locator(".string-row").evaluateAll((els) =>
    els.slice(0, 2).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    })
  );
  if (card0.y !== card1.y) throw new Error(`${label}: guitar strings should be laid out horizontally`);
  console.log(`✓ ${label}: guitar renders 6 strings in a horizontal grid`);

  // Instrument switch to erhu (2 strings).
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").nth(4).click();
  await page.waitForTimeout(250);
  if ((await page.locator(".string-row").count()) !== 2) {
    throw new Error(`${label}: expected 2 erhu strings`);
  }
  console.log(`✓ ${label}: instrument switch to erhu renders 2 strings`);

  // Harmonica: 10×2 grid + position expansion.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").last().click();
  await page.waitForSelector(".harmonica-grid", { timeout: 8000 });
  if ((await page.locator(".harmonica-cell").count()) !== 20) {
    throw new Error(`${label}: expected 20 harmonica cells`);
  }
  await page.locator(".harmonica-cell").nth(3).click();
  await page.waitForSelector(".position-chips", { timeout: 5000 });
  const chips = await page.locator(".position-chip").count();
  if (chips < 2) throw new Error(`${label}: expected position chips`);
  console.log(`✓ ${label}: harmonica grid (20 cells) + ${chips} position targets`);

  await assertNoHOverflow(page, label);
}

try {
  const legacy = await browser.newPage();
  await legacy.goto(`${BASE_URL}/#/metronome`, { waitUntil: "networkidle" });
  if (new URL(legacy.url()).pathname !== "/metronome") {
    throw new Error(`legacy metronome bookmark was not migrated: ${legacy.url()}`);
  }
  await legacy.close();
  console.log("✓ legacy hash bookmark migrates to a clean route");

  // ---- Desktop ----
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attachListeners(desktop, "desktop");
  await desktop.goto(BASE_URL, { waitUntil: "networkidle" });
  await walkWorkbench(desktop, "desktop");

  // Tuner is horizontal: needle left, strings/harmonica right, same row.
  const needleBox = await desktop.locator(".tuner-big").boundingBox();
  const panelBox = await desktop.locator(".harmonica-grid").boundingBox();
  if (!needleBox || !panelBox) throw new Error("desktop: missing tuner-main children");
  if (!(needleBox.x + needleBox.width <= panelBox.x + 8)) {
    throw new Error("desktop: big needle should sit left of the panel");
  }
  if (Math.abs(needleBox.y - panelBox.y) > 40) {
    throw new Error("desktop: needle and panel should share a row (tuner-main 2 columns)");
  }
  console.log("✓ desktop: tuner stretches horizontally (needle | panel side by side)");

  // Tool-level navigation: one shell, several music tools.
  if ((await desktop.locator(".tool-nav-link").count()) !== 2) {
    throw new Error("desktop: expected tuning + metronome nav links");
  }
  console.log("✓ desktop: shell exposes both tools");

  // Language switch updates the brand.
  await desktop.click(".lang-toggle button[data-lang='en']");
  await desktop.waitForTimeout(200);
  const brand = await desktop.locator("h1").textContent();
  if (!brand.includes("Music Lab")) throw new Error(`expected English brand, got ${brand}`);
  console.log("✓ desktop: language switch to English works");

  // Theme toggle flips data-theme and the body background follows.
  const darkBg = await desktop.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor
  );
  await desktop.click(".theme-toggle");
  await desktop.waitForTimeout(200);
  const themeAttr = await desktop.evaluate(() => document.documentElement.dataset.theme);
  const lightBg = await desktop.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor
  );
  if (themeAttr !== "light") throw new Error(`expected data-theme=light, got ${themeAttr}`);
  if (darkBg === lightBg) throw new Error("theme toggle did not change the body background");
  await assertNoHOverflow(desktop, "desktop light");
  await desktop.click(".theme-toggle");
  await desktop.waitForTimeout(200);
  console.log("✓ desktop: theme toggle switches dark/light without overflow");

  await walkMetronome(desktop, "desktop", { expectSingleScreen: true });

  // ---- Mobile ----
  const mobile = await browser.newPage({ viewport: { width: 375, height: 667 } });
  attachListeners(mobile, "mobile");
  await mobile.goto(BASE_URL, { waitUntil: "networkidle" });
  await walkWorkbench(mobile, "mobile");

  // Tuner collapses to one column: needle above the panel, same x.
  const mNeedle = await mobile.locator(".tuner-big").boundingBox();
  const mPanel = await mobile.locator(".harmonica-grid").boundingBox();
  if (!mNeedle || !mPanel) throw new Error("mobile: missing tuner-main children");
  if (!(mNeedle.y + mNeedle.height <= mPanel.y + 8)) {
    throw new Error("mobile: needle should stack above the panel below 900px");
  }
  console.log("✓ mobile: tuner falls back to a single column");

  await walkMetronome(mobile, "mobile");

  await mobile.close();
  await desktop.close();

  console.log(
    errors.length ? `✗ ${errors.length} console/page errors:\n${errors.join("\n")}` : "✓ no console or page errors"
  );
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(`✗ smoke test failed: ${error.message}`);
  console.error(errors.length ? `errors captured:\n${errors.join("\n")}` : "no console errors captured");
  process.exitCode = 1;
} finally {
  await browser.close();
}
