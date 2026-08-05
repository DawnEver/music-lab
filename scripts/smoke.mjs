/**
 * Headless smoke test: boots the app in Edge (Chromium) and walks the two
 * routes, asserting the key UI surfaces render and capturing console/page
 * errors. Run against a dev server:  npm run dev, then  node scripts/smoke.mjs
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

  // Landing route is the tuner (hash redirect from /).
  await page.waitForSelector(".nav-pill", { timeout: 8000 });
  await page.waitForSelector(".strings-panel", { timeout: 8000 });
  console.log("✓ tuner route renders (strings panel for guitar)");

  // Switch instruments and presets via the selects.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").nth(4).click(); // 二胡 (erhu)
  await page.waitForTimeout(300);
  const stringRows = await page.locator(".string-row").count();
  if (stringRows !== 2) throw new Error(`expected 2 erhu strings, got ${stringRows}`);
  console.log("✓ instrument switch to erhu renders 2 strings");

  // Harmonica: pick 布鲁斯口琴, verify the 10×2 grid and bend expansion.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").last().click();
  await page.waitForSelector(".harmonica-grid", { timeout: 8000 });
  const cells = await page.locator(".harmonica-cell").count();
  if (cells !== 20) throw new Error(`expected 20 harmonica cells, got ${cells}`);
  console.log("✓ harmonica grid renders 20 cells");

  await page.locator(".harmonica-cell").nth(3).click(); // hole 2 blow
  await page.waitForSelector(".position-chips", { timeout: 5000 });
  const chips = await page.locator(".position-chip").count();
  if (chips < 2) throw new Error(`expected position chips, got ${chips}`);
  console.log(`✓ hole cell expansion shows ${chips} position targets`);

  // Analyzer route keeps the classic dashboard.
  await page.click('a[href="#/analyzer"]');
  await page.waitForSelector(".metric-card.pitch", { timeout: 8000 });
  await page.waitForSelector(".spectrum-wrap canvas", { timeout: 8000 });
  await page.waitForSelector(".chroma", { timeout: 8000 });
  console.log("✓ analyzer route renders pitch/chord/spectrum cards");

  // Language switch.
  await page.click(".lang-toggle button[data-lang='en']");
  await page.waitForTimeout(200);
  const navText = await page.locator(".nav-pill").first().textContent();
  if (!navText.includes("Tuner")) throw new Error(`expected English nav, got ${navText}`);
  console.log("✓ language switch to English works");

  console.log(errors.length ? `✗ ${errors.length} console/page errors:\n${errors.join("\n")}` : "✓ no console or page errors");
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(`✗ smoke test failed: ${error.message}`);
  console.error(errors.length ? `errors captured:\n${errors.join("\n")}` : "no console errors captured");
  process.exitCode = 1;
} finally {
  await browser.close();
}
