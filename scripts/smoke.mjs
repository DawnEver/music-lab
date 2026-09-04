/**
 * Headless smoke test: boots the app in a system Chromium browser and walks
 * both tools (tuning workbench + metronome) on BOTH desktop and mobile viewports — collapsible panels,
 * horizontal tuner layout, instrument switching, harmonica positions,
 * i18n, and horizontal-overflow checks. Captures console/page errors.
 * Starts its own dev server unless SMOKE_URL points at a running one.
 * Run:  npm run smoke
 */

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { once } from "node:events";

const PORT = process.env.SMOKE_PORT ?? "5199";
const BASE_URL = process.env.SMOKE_URL ?? `http://localhost:${PORT}`;

/**
 * Boot vite on the smoke port and resolve once it is serving. Returns a
 * stop function; when SMOKE_URL is set we attach to that server instead and
 * start nothing.
 */
async function startDevServer() {
  if (process.env.SMOKE_URL) return () => {};

  const server = spawn("npx", ["vite", "--port", PORT, "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stop = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.on("exit", stop);

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server did not start in 30s")), 30000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("ready in") || String(chunk).includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`dev server exited with code ${code}`));
    });
  });

  await ready;
  // vite prints "Local:" a beat before it answers the first request.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return async () => {
    stop();
    await once(server, "exit").catch(() => {});
  };
}

const stopDevServer = await startDevServer();

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
  const expectedPath = `/${tool}`;
  const pathname = new URL(page.url()).pathname;
  if (pathname !== expectedPath) {
    throw new Error(`${tool}: expected clean route ${expectedPath}, got ${pathname}`);
  }
}

async function walkMetronome(page, label, { expectSingleScreen = false } = {}) {
  await gotoTool(page, "rhythm");

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

  // The mic picker must not follow the user into the metronome, and the
  // metronome must not hold the input session open.
  if ((await page.locator(".source-actions").count()) !== 0) {
    throw new Error(`${label}: the audio source bar should stay in the tuning tool`);
  }

  await assertNoHOverflow(page, `${label} metronome`);
  await gotoTool(page, "tune");
}

/** The scope: one canvas, its layer/window chips, and the freeze toggle. */
async function walkScope(page, label) {
  await gotoTool(page, "scope");
  await page.waitForSelector("[data-scope-canvas] canvas", { timeout: 8000 });

  const size = await page.locator("[data-scope-canvas] canvas").boundingBox();
  if (!size || size.height < 200) {
    throw new Error(`${label}: the scope canvas should be a stage, got ${size?.height}px`);
  }
  console.log(`✓ ${label}: scope renders one wide canvas`);

  // Layers and windows are chips on the stage, not a settings panel.
  const chips = await page.locator(".scope-toggles .metro-chip").count();
  if (chips < 7) {
    throw new Error(`${label}: expected layer, window, freeze and clear chips, got ${chips}`);
  }

  const freeze = page.locator("[data-scope-freeze]");
  const before = await freeze.innerText();
  await freeze.click();
  await page.waitForTimeout(120);
  if ((await freeze.innerText()) === before) {
    throw new Error(`${label}: freeze should toggle to resume`);
  }
  await freeze.click();
  console.log(`✓ ${label}: freeze toggles and releases`);

  // The range summary is always present, even before anything is heard.
  await page.waitForSelector("[data-scope-range]", { timeout: 8000 });

  await assertNoHOverflow(page, `${label} scope`);
  await gotoTool(page, "tune");
}

/** Ear training: the whole loop is hear -> answer -> verdict -> next. */
async function walkEar(page, label) {
  await gotoTool(page, "ear");
  await page.waitForSelector("[data-ear-pad] .ear-choice", { timeout: 8000 });

  // No microphone here: ear training only needs the output side.
  if ((await page.locator(".source-actions").count()) !== 0) {
    throw new Error(`${label}: ear training should not ask for a microphone`);
  }

  const choices = await page.locator("[data-ear-pad] .ear-choice").count();
  if (choices < 3) throw new Error(`${label}: expected an answer pad, got ${choices} choices`);

  // Answering marks the right choice and unlocks the next question.
  await page.locator("[data-ear-pad] .ear-choice").first().click();
  await page.waitForSelector("[data-ear-pad] .ear-choice.is-right", { timeout: 4000 });
  const verdict = (await page.locator("[data-ear-verdict]").innerText()).trim();
  if (!verdict) throw new Error(`${label}: answering should show a verdict`);
  if (await page.locator("[data-ear-next]").isDisabled()) {
    throw new Error(`${label}: next should be enabled once answered`);
  }
  await page.locator("[data-ear-next]").click();
  await page.waitForTimeout(150);
  if ((await page.locator("[data-ear-pad] .ear-choice.is-right").count()) !== 0) {
    throw new Error(`${label}: the next question should clear the previous verdict`);
  }
  console.log(`✓ ${label}: ear training answers, grades and moves on`);

  // Switching kind swaps the pad.
  await page.locator('[data-ear-kind="chord"]').click();
  await page.waitForTimeout(150);
  const chordChoices = await page.locator("[data-ear-pad] .ear-choice").count();
  if (chordChoices < 2) throw new Error(`${label}: chord pad should render choices`);
  console.log(`✓ ${label}: switching question kind swaps the answer pad`);

  // Sight-singing is a mode of the same tool, and the only one that asks
  // for a microphone.
  await page.locator('[data-ear-kind="sing"]').click();
  await page.waitForSelector("[data-sing-canvas] canvas", { timeout: 8000 });
  if ((await page.locator(".source-actions").count()) === 0) {
    throw new Error(`${label}: sight-singing needs the source bar`);
  }
  if (await page.locator("[data-sing-start]").isEnabled()) {
    throw new Error(`${label}: singing should be blocked until an input is chosen`);
  }
  await page.locator("[data-sing-new]").click();
  await page.waitForTimeout(120);
  console.log(`✓ ${label}: sight-singing draws the written line and waits for a mic`);

  await assertNoHOverflow(page, `${label} ear`);
  await gotoTool(page, "tune");
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

  // Row *count* is a component test; what only a browser can answer is
  // whether the rows lay out side by side.
  const [card0, card1] = await page.locator(".string-row").evaluateAll((els) =>
    els.slice(0, 2).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    })
  );
  if (card0.y !== card1.y) throw new Error(`${label}: guitar strings should be laid out horizontally`);
  console.log(`✓ ${label}: guitar renders 6 strings in a horizontal grid`);

  // The instrument picker is grouped: category subheaders are rendered as
  // subheaders, not as selectable rows.
  await page.locator(".v-select").nth(0).click();
  await page.waitForSelector(".v-list-item", { timeout: 5000 });
  const groups = await page.locator(".v-list-subheader").count();
  const options = await page.locator(".v-list-item").count();
  if (groups < 3) throw new Error(`${label}: expected category subheaders, got ${groups}`);
  if (options !== 22) throw new Error(`${label}: expected 22 instruments, got ${options}`);
  console.log(`✓ ${label}: instrument picker groups ${options} instruments into ${groups} categories`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Instrument switch to erhu (2 strings) — picked by name, the list is
  // grouped by category so positions shift as instruments are added.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").filter({ hasText: /^(Erhu|二胡)$/ }).first().click();
  await page.waitForTimeout(250);
  if ((await page.locator(".string-row").count()) !== 2) {
    throw new Error(`${label}: expected 2 erhu strings`);
  }
  console.log(`✓ ${label}: instrument switch to erhu renders 2 strings`);

  // Harmonica: 10×2 grid + position expansion.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").filter({ hasText: /Harmonica|口琴/ }).first().click();
  await page.waitForSelector(".harmonica-grid", { timeout: 8000 });
  await page.locator(".harmonica-cell").nth(3).click();
  await page.waitForSelector(".position-chips", { timeout: 5000 });
  console.log(`✓ ${label}: harmonica grid renders and expands in the browser`);

  // A wind instrument swaps in the fingering chart.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").filter({ hasText: /^(Dizi|笛子)$/ }).first().click();
  await page.waitForSelector(".fingering-panel", { timeout: 8000 });
  const holes = await page.locator(".fingering-card").first().locator(".fingering-hole").count();
  if (holes !== 6) throw new Error(`${label}: expected a 6-hole diagram, got ${holes}`);
  console.log(`✓ ${label}: dizi renders a fingering chart`);

  // Back to the harmonica: the layout checks below measure that panel.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").filter({ hasText: /Harmonica|口琴/ }).first().click();
  await page.waitForSelector(".harmonica-grid", { timeout: 8000 });

  await assertNoHOverflow(page, label);
}

try {
  const legacy = await browser.newPage();
  await legacy.goto(`${BASE_URL}/#/metronome`, { waitUntil: "networkidle" });
  if (new URL(legacy.url()).pathname !== "/rhythm") {
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
  if ((await desktop.locator(".tool-nav-link").count()) !== 4) {
    throw new Error("desktop: expected tune + scope + rhythm + ear nav links");
  }
  console.log("✓ desktop: shell exposes all four tools");

  // The header carries the build version next to the title.
  const versionText = await desktop.locator(".brand-version").innerText();
  if (!/^v\d+\.\d+\.\d+$/.test(versionText)) {
    throw new Error(`desktop: expected a version badge, got "${versionText}"`);
  }
  console.log(`✓ desktop: header shows ${versionText}`);

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

  await walkScope(desktop, "desktop");
  await walkEar(desktop, "desktop");
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

  await walkScope(mobile, "mobile");
  await walkEar(mobile, "mobile");
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
  await stopDevServer();
}
