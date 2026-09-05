/**
 * One screenshot, for looking at the thing you just changed.
 *
 * Layout and colour are judged by eye, and a headless page is the only
 * way to get a deterministic one. `npm run shot -- <url> <out.png> [theme]
 * [js]` — the js runs in the page before the shot, for setting up a state
 * that needs a click or two.
 */
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
const [url, out, theme, script] = process.argv.slice(2);
await page.addInitScript((t) => {
  localStorage.setItem("ml.theme", t);
  document.documentElement.dataset.theme = t;
}, theme ?? "dark");
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme ?? "dark");
if (script) await page.evaluate(script);
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
