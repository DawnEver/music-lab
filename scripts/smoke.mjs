/**
 * Headless smoke test: boots the app in Edge (Chromium) and walks the
 * workbench on BOTH desktop and mobile viewports — collapsible panels,
 * horizontal tuner layout, instrument switching, harmonica positions,
 * i18n, and horizontal-overflow checks. Captures console/page errors.
 * Run:  npm run dev   then   node scripts/smoke.mjs
 */

import { chromium } from "playwright-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:5199";

const browser = await chromium.launch({ channel: "msedge", headless: true });
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
  // ---- Desktop ----
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attachListeners(desktop, "desktop");
  await desktop.goto(URL, { waitUntil: "networkidle" });
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

  // No nav pills anymore (single interface).
  if ((await desktop.locator(".app-nav").count()) !== 0) {
    throw new Error("desktop: navigation should be removed");
  }
  console.log("✓ desktop: single interface (no nav)");

  // Language switch updates the brand.
  await desktop.click(".lang-toggle button[data-lang='en']");
  await desktop.waitForTimeout(200);
  const brand = await desktop.locator("h1").textContent();
  if (!brand.includes("Tuning Lab")) throw new Error(`expected English brand, got ${brand}`);
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

  // ---- Mobile ----
  const mobile = await browser.newPage({ viewport: { width: 375, height: 667 } });
  attachListeners(mobile, "mobile");
  await mobile.goto(URL, { waitUntil: "networkidle" });
  await walkWorkbench(mobile, "mobile");

  // Tuner collapses to one column: needle above the panel, same x.
  const mNeedle = await mobile.locator(".tuner-big").boundingBox();
  const mPanel = await mobile.locator(".harmonica-grid").boundingBox();
  if (!mNeedle || !mPanel) throw new Error("mobile: missing tuner-main children");
  if (!(mNeedle.y + mNeedle.height <= mPanel.y + 8)) {
    throw new Error("mobile: needle should stack above the panel below 900px");
  }
  console.log("✓ mobile: tuner falls back to a single column");

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
