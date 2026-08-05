/**
 * Headless smoke test: boots the app in Edge (Chromium) and walks the
 * workbench — collapsible panels, both focus modes, instrument switching,
 * harmonica positions, i18n. Captures console/page errors.
 * Run:  npm run dev   then   node scripts/smoke.mjs
 */

import { chromium } from "playwright-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:5199";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`[console] ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`[pageerror] ${String(error)}`));

try {
  await page.goto(URL, { waitUntil: "networkidle" });

  // Workbench: all five panels open by default.
  await page.waitForSelector(".nav-pill", { timeout: 8000 });
  await page.waitForSelector(".strings-panel", { timeout: 8000 });
  await page.waitForSelector(".metric-card.pitch", { timeout: 8000 });
  await page.waitForSelector(".metric-card.chord", { timeout: 8000 });
  await page.waitForSelector("section.spectrum-card .spectrum-wrap canvas", { timeout: 8000 });
  await page.waitForSelector("section.control-card .v-slider", { timeout: 8000 });
  console.log("✓ workbench renders all 5 panels expanded");

  // Collapsing a panel unmounts its content (spectrum canvas unregisters).
  await page.click("section.spectrum-card .card-toggle");
  await page.waitForTimeout(300);
  const canvases = await page.locator("section.spectrum-card canvas").count();
  if (canvases !== 0) throw new Error(`expected collapsed spectrum canvas to unmount, got ${canvases}`);
  await page.click("section.spectrum-card .card-toggle"); // reopen
  await page.waitForSelector("section.spectrum-card canvas", { timeout: 5000 });
  console.log("✓ panel collapse unmounts content and re-expands");

  // Instrument switch: erhu has 2 strings.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").nth(4).click(); // 二胡
  await page.waitForTimeout(300);
  const stringRows = await page.locator(".string-row").count();
  if (stringRows !== 2) throw new Error(`expected 2 erhu strings, got ${stringRows}`);
  console.log("✓ instrument switch to erhu renders 2 strings");

  // Harmonica: 10×2 grid + bend/overblow position expansion.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").last().click();
  await page.waitForSelector(".harmonica-grid", { timeout: 8000 });
  const cells = await page.locator(".harmonica-cell").count();
  if (cells !== 20) throw new Error(`expected 20 harmonica cells, got ${cells}`);
  await page.locator(".harmonica-cell").nth(3).click(); // hole 2 draw
  await page.waitForSelector(".position-chips", { timeout: 5000 });
  const chips = await page.locator(".position-chip").count();
  if (chips < 2) throw new Error(`expected position chips, got ${chips}`);
  console.log(`✓ harmonica grid (20 cells) + ${chips} position targets`);

  // Focus mode #/tuner: tuner only (current instrument is the harmonica),
  // no analyzer cards, no collapse chevron.
  await page.click('a[href="#/tuner"]');
  await page.waitForSelector(".tuner-card .harmonica-grid", { timeout: 8000 });
  await page.waitForTimeout(300);
  const tunerFocusCards = await page.locator(".metric-card.pitch").count();
  if (tunerFocusCards !== 0) throw new Error("focus #/tuner should hide the pitch card");
  const tunerToggles = await page.locator(".tuner-card .card-chevron").count();
  if (tunerToggles !== 0) throw new Error("focus mode should hide the collapse chevron");
  console.log("✓ focus #/tuner shows only the tuner panel");

  // Focus mode #/analyzer: analyzer cards, no tuner panel.
  await page.click('a[href="#/analyzer"]');
  await page.waitForSelector(".metric-card.pitch", { timeout: 8000 });
  await page.waitForTimeout(300);
  const analyzerFocusStrings = await page.locator(".strings-panel").count();
  if (analyzerFocusStrings !== 0) throw new Error("focus #/analyzer should hide the tuner panel");
  console.log("✓ focus #/analyzer shows only the analyzer cards");

  // Workbench nav back home (instrument is still the harmonica).
  await page.click('a[href="#/"]');
  await page.waitForSelector(".tuner-card .harmonica-grid", { timeout: 8000 });
  console.log("✓ workbench nav returns");

  // Language switch.
  await page.click(".lang-toggle button[data-lang='en']");
  await page.waitForTimeout(200);
  const navText = await page.locator(".nav-pill").first().textContent();
  if (!navText.includes("Workbench")) throw new Error(`expected English nav, got ${navText}`);
  console.log("✓ language switch to English works");

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
