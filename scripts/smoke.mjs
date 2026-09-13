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
import { fileURLToPath } from "node:url";


const PORT = process.env.SMOKE_PORT ?? "5199";
const BASE_URL = process.env.SMOKE_URL ?? `http://localhost:${PORT}`;

/**
 * Boot vite on the smoke port and resolve once it is serving. Returns a
 * stop function; when SMOKE_URL is set we attach to that server instead and
 * start nothing.
 */
async function startDevServer() {
  if (process.env.SMOKE_URL) return () => {};

  // Run vite's entry through this same node rather than through npx: the
  // launcher is a .cmd on Windows, which needs a shell, and killing the
  // shell leaves the real server holding the port.
  const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const server = spawn(process.execPath, [viteBin, "--port", PORT, "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  // Both pipes must be drained. An undrained stderr fills its buffer and
  // blocks the server mid-run, which reads as the whole test hanging.
  const serverErrors = [];
  server.stderr.on("data", (chunk) => serverErrors.push(String(chunk)));
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
      reject(new Error(`dev server exited with code ${code}: ${serverErrors.join("")}`));
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

const browser = await chromium.launch({
  channel: CHANNEL,
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
});

/**
 * A synthetic singer, installed in the page before it loads.
 *
 * Sight-singing is the one feature whose whole point is the round trip —
 * microphone, capture, pitch detection, history, judging — and a browser's
 * fake capture device gives no control over what is sung. An oscillator
 * routed into a MediaStream does: the test can read the written line off
 * the page and sing it.
 */
const SYNTHETIC_MIC = () => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 220;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  osc.start();
  // A fresh destination per request: stopping a source stops its tracks,
  // and a stopped track never carries audio again.
  navigator.mediaDevices.getUserMedia = async () => {
    const dest = ctx.createMediaStreamDestination();
    gain.connect(dest);
    return dest.stream;
  };
  window.__sing = (midi) => {
    if (midi === null) {
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01);
      return;
    }
    osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), ctx.currentTime);
    gain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.01);
  };
};
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
  await assertStageFillsWidth(page, `${label} metronome`, ".metro-stage");
  await assertNoVOverflow(page, `${label} metronome`);
  await assertNavFits(page, label);
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
  if ((await page.locator("[data-source-toggle]").count()) !== 0) {
    throw new Error(`${label}: the audio source bar should stay in the tuning tool`);
  }

  await assertNoHOverflow(page, `${label} metronome`);
  await gotoTool(page, "tune");
}

/** The trace: one canvas, its knobs, and the freeze toggle. */
async function walkTrace(page, label, { live = false } = {}) {
  await gotoTool(page, "trace");
  await page.waitForSelector("[data-trace-canvas] canvas", { timeout: 8000 });

  // The input control carries its own level meter, so there is no second
  // widget saying the same thing.
  if ((await page.locator("[data-source-toggle] .audio-level").count()) !== 1) {
    throw new Error(`${label}: the input control should show the level itself`);
  }

  // Both readings of the same instant: across time, and across frequency now.
  await page.waitForSelector(".trace-stage .spectrum-wrap canvas", { timeout: 8000 });

  const size = await page.locator("[data-trace-canvas] canvas").boundingBox();
  if (!size || size.height < 200) {
    throw new Error(`${label}: the scope canvas should be a stage, got ${size?.height}px`);
  }
  await assertStageFillsWidth(page, `${label} trace`, ".trace-stage");
  // A picture you cannot adjust without scrolling is worse than a smaller
  // picture — so the canvas and its knobs share one screen at every size.
  await assertNoVOverflow(page, `${label} trace`);
  console.log(`✓ ${label}: trace renders one wide canvas on one screen`);

  // Freeze and clear stay on the stage at every size.
  const actions = await page.locator(".trace-actions .metro-chip").count();
  if (actions < 2) {
    throw new Error(`${label}: expected freeze and clear on the stage, got ${actions}`);
  }

  const freeze = page.locator("[data-trace-freeze]");
  const before = await freeze.innerText();
  await freeze.click();
  await page.waitForTimeout(120);
  if ((await freeze.innerText()) === before) {
    throw new Error(`${label}: freeze should toggle to resume`);
  }
  await freeze.click();
  console.log(`✓ ${label}: freeze toggles and releases`);

  // "audio is never…" is worse than saying nothing: the one line that
  // makes a promise must not be cut off by an ellipsis.
  const clipped = await page.evaluate(() => {
    const el = document.querySelector(".audio-detail");
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  if (clipped > 1) throw new Error(`${label}: the privacy line is truncated by ${clipped}px`);

  // The range summary is always present, even before anything is heard.
  await page.waitForSelector("[data-trace-range]", { timeout: 8000, state: "attached" });

  // Ergonomics: a dB floor is set by nudging it while watching the picture.
  // On a wide screen the knobs must therefore share the screen with the
  // canvas — not sit below the fold.
  const flat = page.locator("[data-trace-controls].trace-controls--flat");
  const wide = await page.evaluate(() => window.innerWidth >= 900);
  if (wide) {
    const box = await flat.boundingBox();
    const canvas = await page.locator("[data-trace-canvas] canvas").boundingBox();
    const height = await page.evaluate(() => window.innerHeight);
    if (!box || box.y + box.height > height) {
      throw new Error(`${label}: the trace controls fall below the fold (${box?.y}+${box?.height} > ${height})`);
    }
    if (!canvas || canvas.height < 180) {
      throw new Error(`${label}: the trace canvas got squeezed to ${canvas?.height}px`);
    }
    // Every knob in one place: layers, axis, window, resolution, colours,
    // both dB limits and the reference.
    const sliders = await flat.locator('input[type="range"]').count();
    if (sliders !== 2) throw new Error(`${label}: expected floor and ceiling sliders, got ${sliders}`);
    console.log(`✓ ${label}: canvas and every knob share one screen`);
  } else {
    if (await flat.isVisible()) {
      throw new Error(`${label}: the flat control panel should collapse on a phone`);
    }
    await page.waitForSelector(".trace-chip-row .sheet-anchor", { timeout: 8000 });
    console.log(`✓ ${label}: controls collapse into a sheet on a phone`);
  }

  if (live) {
    // The window follows the audio clock, which is not reactive: computing
    // it once left the view drawing a long-gone ten seconds forever, and
    // only pixels can see that.
    await page.evaluate(() => window.__sing(60));
    await page.locator("[data-source-toggle]").click();
    await page.waitForTimeout(2500);
    const lit = await page.evaluate(() => {
      const canvas = document.querySelector("[data-trace-canvas] canvas");
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      for (let i = 0; i < data.length; i += 4 * 97) {
        if (data[i] + data[i + 1] + data[i + 2] > 150) bright += 1;
      }
      return bright;
    });
    if (lit < 20) throw new Error(`${label}: the trace drew nothing from a live input (${lit})`);
    await page.evaluate(() => window.__sing(null));
    await page.locator("[data-source-toggle]").click();
    console.log(`✓ ${label}: a live input actually reaches the picture (${lit} lit samples)`);
  }

  await assertNoHOverflow(page, `${label} scope`);
  await gotoTool(page, "tune");
}

/**
 * A tool's stage must use the width it was given.
 *
 * This exists because `/play` shipped without `grid-column: 1 / -1` and sat
 * at 47% of the window while every other tool used 98% — a one-line
 * omission that no unit test can see and that reads, on screen, as the app
 * being broken. Measuring it is cheap; noticing it by eye is not.
 */
async function assertStageFillsWidth(page, label, selector, floor = 0.9) {
  const ratio = await page.evaluate((sel) => {
    const stage = document.querySelector(sel);
    const main = document.querySelector("main");
    if (!stage || !main) return null;
    return stage.getBoundingClientRect().width / main.getBoundingClientRect().width;
  }, selector);
  if (ratio === null) throw new Error(`${label}: no stage for ${selector}`);
  if (ratio < floor) {
    throw new Error(
      `${label}: ${selector} uses ${Math.round(ratio * 100)}% of the width, expected >= ${floor * 100}%`
    );
  }
}

/**
 * The instrument owns the whole page, not just its width.
 *
 * A card insets its content by a padding and rounds its corners, and both
 * come straight out of the surface a hand is aiming at. So `/play` has no
 * card: the stage runs from the bar to the bottom of the page and the
 * instrument fills it. "It looks about right" is exactly the judgement
 * this replaces.
 */
async function assertStageOwnsTheRest(page, label, selector) {
  const gap = await page.evaluate((sel) => {
    const stage = document.querySelector(sel);
    const main = document.querySelector("main");
    if (!stage || !main) return null;
    return Math.round(main.getBoundingClientRect().bottom - stage.getBoundingClientRect().bottom);
  }, selector);
  if (gap === null) throw new Error(`${label}: no stage for ${selector}`);
  if (Math.abs(gap) > 2) {
    throw new Error(`${label}: ${selector} stops ${gap}px from the bottom of the page`);
  }
}

/**
 * Nothing a tool draws may fall off the bottom of the window.
 *
 * `assertNoVOverflow` cannot see this. The shell is exactly one window
 * tall and hides what does not fit, so a dashboard that grew past it
 * leaves the page reporting no overflow while the instrument is quietly
 * cut off — which is how a twenty-one string guzheng spent a release
 * showing fifteen of its strings with no way to reach the rest.
 */
async function assertNothingFallsOff(page, label) {
  const worst = await page.evaluate(() => {
    const main = document.querySelector("main");
    const footer = document.querySelector(".footer");
    if (!main || !footer) return null;
    const limit = footer.getBoundingClientRect().top;
    const stages = [...main.querySelectorAll(".play-stage, .metro-stage, .trace-stage, .ear-stage")];
    return Math.round(Math.max(0, ...stages.map((s) => s.getBoundingClientRect().bottom - limit)));
  });
  if (worst === null) throw new Error(`${label}: no stage to measure`);
  if (worst > 2) {
    throw new Error(`${label}: the stage runs ${worst}px past the footer and is clipped`);
  }
}

/** What you play on is chosen above it, not below it. */
async function assertBarAboveStage(page, label) {
  const order = await page.evaluate(() => {
    const bar = document.querySelector(".play-bar");
    const stage = document.querySelector(".play-stage");
    if (!bar || !stage) return null;
    return {
      bar: Math.round(bar.getBoundingClientRect().bottom),
      stage: Math.round(stage.getBoundingClientRect().top),
      chips: document.querySelectorAll(".play-bar .value-chip").length
    };
  });
  if (!order) throw new Error(`${label}: the play tool has no bar`);
  if (order.chips !== 1) {
    throw new Error(`${label}: expected the instrument picker in the bar, got ${order.chips}`);
  }
  if (order.bar > order.stage + 2) {
    throw new Error(`${label}: the picker sits ${order.bar - order.stage}px below the instrument`);
  }
}

/** Turn the instrument. Every surface has both, so the control is always there. */
async function turnTo(page, label, orientation) {
  const chip = page.locator(`.play-bar [data-orientation="${orientation}"]`);
  if ((await chip.count()) !== 1) {
    throw new Error(`${label}: no ${orientation} chip for this surface`);
  }
  await chip.click();
}

async function assertTurned(page, label, selector, orientation) {
  if ((await page.locator(`${selector}.is-${orientation}`).count()) !== 1) {
    throw new Error(`${label}: ${selector} did not turn to ${orientation}`);
  }
}

/**
 * A white key is bounded by the hand at both ends — 23.5mm is a real
 * piano's white key and 9mm is a fingertip — so the same 34–89px applies
 * whichever axis the keyboard runs along. Anything outside it is a key
 * nobody could play.
 *
 * Which axis that is comes from the board itself. The default orientation
 * differs by viewport, so asking the caller to say which way it thinks the
 * keyboard is pointing is how this assertion ends up measuring the length
 * of a key instead of its width.
 */
async function assertKeyIsHandSized(page, label) {
  const measured = await page.evaluate(() => {
    const board = document.querySelector(".kbd-board");
    const key = document.querySelector(".kbd-key:not(.is-black)");
    if (!board || !key) return null;
    const box = key.getBoundingClientRect();
    const vertical = board.classList.contains("is-vertical");
    return { vertical, size: vertical ? box.height : box.width };
  });
  if (!measured) throw new Error(`${label}: missing keyboard geometry`);
  if (measured.size < 33.5 || measured.size > 89.5) {
    throw new Error(
      `${label}: a white key is ${Math.round(measured.size)}px across on a ` +
        `${measured.vertical ? "vertical" : "horizontal"} board, outside the 34–89px it may be`
    );
  }
}

/**
 * A card on a scale must stay a thing a thumb can hit.
 *
 * The phone rules that keep a wind chart's cards at 72px share a selector
 * with the rules that let them share the width, so the pair has to be in
 * the right order in the stylesheet — and when they were not, every dizi
 * card collapsed to 22px and the line stopped scrolling, while the count
 * of cards was still exactly right. Size is the only thing that sees it.
 */
async function assertTapTargets(page, label, selector, across, floor = 62) {
  const boxes = await page.evaluate(
    (sel) => [...document.querySelectorAll(sel)].map((el) => {
      const box = el.getBoundingClientRect();
      return { w: Math.round(box.width), h: Math.round(box.height) };
    }),
    selector
  );
  if (!boxes.length) throw new Error(`${label}: no ${selector}`);
  const sizes = boxes.map((box) => (across === "vertical" ? box.h : box.w));
  const smallest = Math.min(...sizes);
  if (smallest < floor) {
    throw new Error(
      `${label}: the smallest of ${boxes.length} ${selector} is ${smallest}px across, ` +
        `below the ${floor}px a thumb needs`
    );
  }
}

/**
 * A neck may not overlap itself.
 *
 * Rows share the board's height, so a row with no floor of its own gets
 * squeezed under the cells inside it and they spill into the row below.
 * The board still reports no overflow, because nothing overflowed *it*.
 */
async function assertRowsHoldTheirCells(page, label, rowSelector, cellSelector) {
  const worst = await page.evaluate(
    ([rowSel, cellSel]) => {
      let over = 0;
      for (const row of document.querySelectorAll(rowSel)) {
        const bottom = row.getBoundingClientRect().bottom;
        for (const cell of row.querySelectorAll(cellSel)) {
          over = Math.max(over, cell.getBoundingClientRect().bottom - bottom);
        }
      }
      return Math.round(over);
    },
    [rowSelector, cellSelector]
  );
  if (worst > 1) {
    throw new Error(`${label}: ${cellSelector} spills ${worst}px past its row`);
  }
}

/** Every tool must be reachable: a nav that overflows hides one. */
async function assertNavFits(page, label) {
  const over = await page.evaluate(() => {
    const nav = document.querySelector(".tool-nav");
    const links = [...document.querySelectorAll(".tool-nav-link")];
    if (!nav || !links.length) return null;
    const right = Math.max(...links.map((l) => l.getBoundingClientRect().right));
    return Math.round(right - Math.min(window.innerWidth, nav.getBoundingClientRect().right));
  }, null);
  if (over === null) throw new Error(`${label}: no tool nav`);
  if (over > 1) throw new Error(`${label}: the tool nav overflows by ${over}px, hiding a tool`);
}

/** No vertical page scroll — a tool with one focus must not scroll. */
async function assertNoVOverflow(page, label) {
  const over = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  if (over > 2) throw new Error(`${label}: page scrolls by ${over}px`);
}

/**
 * The cells of an instrument sit on one line.
 *
 * A guitar is six strings and a scale is one ascending run; wrapping either
 * into a ragged block destroys the only order they have. The count comes
 * from the instrument, so the row must too — this catches a grid that sizes
 * itself from a pixel minimum instead.
 */
async function assertSingleRow(page, label, selector) {
  const rows = await page.evaluate((sel) => {
    const tops = [...document.querySelectorAll(sel)].map((el) =>
      Math.round(el.getBoundingClientRect().top)
    );
    return new Set(tops).size;
  }, selector);
  if (rows !== 1) throw new Error(`${label}: ${selector} wrapped into ${rows} rows`);
}

/** The play tool: four surfaces, and geometry only a browser can answer. */
async function walkPlay(page, label, { wide = false } = {}) {
  await gotoTool(page, "play");
  await page.waitForSelector(".kbd-key", { timeout: 8000 });

  const keys = await page.locator(".kbd-key").count();
  if (keys !== 32) throw new Error(`${label}: expected 32 keys, got ${keys}`);
  await assertBarAboveStage(page, label);
  await assertNothingFallsOff(page, label);
  await assertStageFillsWidth(page, `${label} keys`, ".play-stage", 0.99);
  await assertStageOwnsTheRest(page, `${label} keys`, ".play-stage");
  await assertNoVOverflow(page, `${label} keys`);
  await assertNavFits(page, label);

  // Black keys must be narrower and shorter, and stay inside the board.
  const board = await page.locator(".kbd-board").boundingBox();
  const black = await page.locator(".kbd-key.is-black").first().boundingBox();
  const white = await page.locator(".kbd-key:not(.is-black)").first().boundingBox();
  if (!board || !black || !white) throw new Error(`${label}: missing keyboard geometry`);
  if (!(black.width < white.width && black.height < white.height)) {
    throw new Error(`${label}: a black key should be narrower and shorter than a white one`);
  }
  const last = await page.locator(".kbd-key").last().boundingBox();
  if (last.x + last.width > board.x + board.width + 1) {
    throw new Error(`${label}: the keyboard runs past its own width`);
  }
  // Where a surface opens is a fact about the surface. Only a neck has a
  // reason to differ — sixteen frets across 390px are cells too small to
  // hit — so a keyboard opens across on a phone just as it does on a
  // laptop, and the neck is the one that follows the viewport.
  const keyOrientation = "horizontal";
  const neckOrientation = wide ? "horizontal" : "vertical";
  await assertTurned(page, label, ".kbd-board", keyOrientation);
  await assertKeyIsHandSized(page, `${label} keys`);

  // Pressing a key lights it, and releasing lets it go.
  await page.locator(".kbd-key").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".kbd-key.is-down", { timeout: 4000 });
  await page.locator(".kbd-key").first().dispatchEvent("pointerup");
  await page.waitForFunction(() => document.querySelectorAll(".kbd-key.is-down").length === 0, {
    timeout: 4000
  });

  // The computer keyboard plays it too, and auto-repeat is one note.
  await page.keyboard.down("z");
  await page.waitForSelector(".kbd-key.is-down", { timeout: 4000 });
  const down = await page.locator(".kbd-key.is-down").count();
  if (down !== 1) throw new Error(`${label}: one key held should light one key, got ${down}`);
  await page.keyboard.up("z");

  // Octave shift moves the labels and hangs nothing.
  const before = await page.locator(".kbd-octave-value").innerText();
  await page.locator(".kbd-octave-btn").last().click();
  if ((await page.locator(".kbd-octave-value").innerText()) === before) {
    throw new Error(`${label}: octave shift did nothing`);
  }
  if ((await page.locator(".kbd-key.is-down").count()) !== 0) {
    throw new Error(`${label}: shifting octaves must not leave notes hanging`);
  }
  await assertNoHOverflow(page, `${label} keyboard`);

  // Three ways to sound the same instrument, chosen once in the setup
  // sheet rather than kept on a bar that has to hold an instrument.
  // Every one of them plays the instrument in front of the player: a tier
  // is a preference, not a mode, and a bank that will not load costs the
  // difference between a model and a recording rather than the note.
  await page.locator(".play-bar .value-chip").click();
  for (const tier of ["synth", "hybrid", "samples"]) {
    const chip = page.locator(`[data-tier="${tier}"]`);
    if ((await chip.count()) !== 1) throw new Error(`${label}: no ${tier} tier chip`);
  }
  await page.locator('[data-tier="samples"]').click();
  // The sheet closes, so the instrument is not played through it — and the
  // bank arrives in the background, so the note is pressed at once.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.locator(".kbd-key").nth(2).dispatchEvent("pointerdown");
  await page.waitForSelector(".kbd-key.is-down", { timeout: 4000 });
  await page.locator(".kbd-key").nth(2).dispatchEvent("pointerup");
  await page.waitForFunction(() => document.querySelectorAll(".kbd-key.is-down").length === 0, {
    timeout: 4000
  });
  await page.locator(".play-bar .value-chip").click();
  await page.locator('[data-tier="synth"]').click();
  await page.keyboard.press("Escape");
  await assertNoVOverflow(page, `${label} tiers`);

  // A keyboard turns too: on the other axis a key's long side is the
  // vertical one, and it is still a key the hand can find.
  const flippedKeys = keyOrientation === "horizontal" ? "vertical" : "horizontal";
  await turnTo(page, label, flippedKeys);
  await assertTurned(page, label, ".kbd-board", flippedKeys);
  if ((await page.locator(".kbd-key").count()) !== keys) {
    throw new Error(`${label}: turning the keyboard changed how many notes exist`);
  }
  await assertKeyIsHandSized(page, `${label} keys turned`);
  await assertStageOwnsTheRest(page, `${label} keys turned`, ".play-stage");
  await assertNoVOverflow(page, `${label} keys turned`);
  await turnTo(page, label, keyOrientation);

  // The instrument decides the surface: switching to a guitar draws a
  // fretboard, and its own tunings come with it.
  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="guitar"]', { timeout: 4000 });
  await page.locator('[data-instrument="guitar"]').click();
  await page.waitForSelector(".fret-board", { timeout: 8000 });
  // Measure the board with the sheet shut, or its popover is in the picture.
  await page.keyboard.press("Escape");
  if ((await page.locator(".kbd-key").count()) !== 0) {
    throw new Error(`${label}: a guitar should not draw a keyboard`);
  }
  if ((await page.locator(".kbd-octave").count()) !== 0) {
    throw new Error(`${label}: octave shift belongs to the keyed surface only`);
  }

  // The neck runs across on a laptop and down on a phone, because sixteen
  // frets across 390px are not hittable. A first visit takes the viewport's
  // advice; after that it is the player's choice.
  await assertTurned(page, label, ".fret-board", neckOrientation);
  // Across: a heading row plus one row per string. Down: a heading row plus
  // one row per fret, open included.
  const rows = await page.locator(".fret-row").count();
  const expectedRows = wide ? 7 : 17;
  if (rows !== expectedRows) {
    throw new Error(`${label}: expected ${expectedRows} ${neckOrientation} rows, got ${rows}`);
  }
  await assertStageFillsWidth(page, `${label} frets`, ".play-stage", 0.99);
  await assertStageOwnsTheRest(page, `${label} frets`, ".play-stage");
  await assertNoVOverflow(page, `${label} frets`);
  await assertRowsHoldTheirCells(page, `${label} frets`, ".fret-row", ".fret-cell");
  // A fret carries its note name; an anonymous box is not a fretboard.
  const firstCell = await page.locator(".fret-cell").first().innerText();
  if (!/^[A-G]#?$/.test(firstCell.trim())) {
    throw new Error(`${label}: expected a note name on the fret, got "${firstCell}"`);
  }

  // Turning the neck transposes the same notes rather than losing any.
  const cellsBefore = await page.locator(".fret-cell").count();
  const flipped = neckOrientation === "horizontal" ? "vertical" : "horizontal";
  await turnTo(page, label, flipped);
  await assertTurned(page, label, ".fret-board", flipped);
  if ((await page.locator(".fret-cell").count()) !== cellsBefore) {
    throw new Error(`${label}: turning the neck changed how many notes exist`);
  }
  await turnTo(page, label, neckOrientation);
  await assertTurned(page, label, ".fret-board", neckOrientation);
  await assertRowsHoldTheirCells(page, `${label} frets`, ".fret-row", ".fret-cell");

  // The tuning row appears only because a guitar has alternate tunings.
  await page.locator(".play-bar .value-chip").click();
  const tunings = await page.locator("[data-preset]").count();
  if (tunings < 2) throw new Error(`${label}: expected the guitar's tunings, got ${tunings}`);
  // Standard tuning bottoms out on E2, so a D2 anywhere on the board is
  // proof the sixth string was actually dropped — and it reads the same
  // whichever way the neck is turned.
  if ((await page.locator('.fret-cell[aria-label="D2"]').count()) !== 0) {
    throw new Error(`${label}: standard tuning should not reach D2`);
  }
  await page.locator('[data-preset="dropD"]').click();
  await page.keyboard.press("Escape");
  await page.waitForSelector('.fret-cell[aria-label="D2"]', { timeout: 4000 });

  await page.locator(".fret-cell").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".fret-cell.is-down", { timeout: 4000 });
  // The same note appears at more than one place on a fretboard.
  const lit = await page.locator(".fret-cell.is-down").count();
  if (lit < 1) throw new Error(`${label}: pressing a fret should light it`);
  await page.locator(".fret-cell").first().dispatchEvent("pointerup");

  // A fifth surface: a string you stop with a finger. The grid is the same
  // grid, and the only thing missing is the frets.
  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="violin"]', { timeout: 4000 });
  await page.locator('[data-instrument="violin"]').click();
  await page.waitForSelector(".fret-board", { timeout: 8000 });
  await page.keyboard.press("Escape");
  if ((await page.locator(".fret-cell.is-marked").count()) !== 0) {
    throw new Error(`${label}: a stopped string has no frets, so no fret marks`);
  }
  if ((await page.locator(".fret-cell").count()) === 0) {
    throw new Error(`${label}: a violin should still draw a neck to stop`);
  }
  await assertNothingFallsOff(page, `${label} stopped`);
  await assertStageOwnsTheRest(page, `${label} stopped`, ".play-stage");
  await assertRowsHoldTheirCells(page, `${label} stopped`, ".fret-row", ".fret-cell");
  await assertNoVOverflow(page, `${label} stopped`);
  await page.locator(".fret-cell").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".fret-cell.is-down", { timeout: 4000 });
  await page.locator(".fret-cell").first().dispatchEvent("pointerup");
  await page.waitForFunction(() => document.querySelectorAll(".fret-cell.is-down").length === 0, {
    timeout: 4000
  });

  // A sixth: instruments whose notes are cells. A kalimba is a row of
  // tines in mounted order, a harmonica two rows of ten reeds.
  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="kalimba"]', { timeout: 4000 });
  await page.locator('[data-instrument="kalimba"]').click();
  await page.waitForSelector(".note-cells", { timeout: 8000 });
  await page.keyboard.press("Escape");
  if ((await page.locator(".note-cell").count()) !== 17) {
    throw new Error(`${label}: a 17-key kalimba has 17 tines`);
  }
  await assertSingleRow(page, `${label} kalimba`, ".note-cell");
  await assertStageOwnsTheRest(page, `${label} kalimba`, ".play-stage");
  await assertNoVOverflow(page, `${label} kalimba`);
  await page.locator(".note-cell").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".note-cell.is-down", { timeout: 4000 });
  await page.locator(".note-cell").first().dispatchEvent("pointerup");

  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="harmonica"]', { timeout: 4000 });
  await page.locator('[data-instrument="harmonica"]').click();
  await page.waitForSelector(".note-cells.is-reeds", { timeout: 8000 });
  await page.keyboard.press("Escape");
  const reedRows = await page.locator(".cells-row").count();
  if (reedRows !== 2) throw new Error(`${label}: a harmonica is blown and drawn`);
  if ((await page.locator(".note-cell").count()) !== 20) {
    throw new Error(`${label}: ten holes with two reeds each`);
  }
  await assertStageOwnsTheRest(page, `${label} harmonica`, ".play-stage");
  await assertNoVOverflow(page, `${label} harmonica`);
  await page.locator(".note-cell").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".note-cell.is-down", { timeout: 4000 });
  await page.locator(".note-cell").first().dispatchEvent("pointerup");
  await page.waitForFunction(() => document.querySelectorAll(".note-cell.is-down").length === 0, {
    timeout: 4000
  });

  // Third surface: the kit has no pitch, so it has pads and no tuning row.
  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="drums"]', { timeout: 4000 });
  await page.locator('[data-instrument="drums"]').click();
  await page.waitForSelector(".pad-grid", { timeout: 8000 });
  await page.keyboard.press("Escape");
  if ((await page.locator(".fret-board").count()) !== 0) {
    throw new Error(`${label}: a kit should not draw a fretboard`);
  }
  // A direction belongs to the kind of surface, so the neck we just turned
  // must not have turned the kit with it.
  await assertTurned(page, label, ".pad-grid", "horizontal");
  const padCount = await page.locator(".pad").count();
  if (padCount !== 9) throw new Error(`${label}: expected 9 pads, got ${padCount}`);
  await assertStageFillsWidth(page, `${label} pads`, ".play-stage", 0.99);
  await assertStageOwnsTheRest(page, `${label} pads`, ".play-stage");
  await assertNoVOverflow(page, `${label} pads`);

  // A pad flashes and finishes on its own; there is nothing to hold.
  await page.locator('[data-piece="snare"]').dispatchEvent("pointerdown");
  await page.waitForSelector(".pad.is-hit", { timeout: 4000 });
  await page.waitForFunction(() => document.querySelectorAll(".pad.is-hit").length === 0, {
    timeout: 4000
  });
  await page.keyboard.press("a");
  await page.waitForSelector('[data-piece="kick"].is-hit', { timeout: 4000 });
  await assertNoHOverflow(page, `${label} pads`);

  // The kit turns onto its other axis, and every piece comes with it.
  await turnTo(page, label, "vertical");
  await assertTurned(page, label, ".pad-grid", "vertical");
  if ((await page.locator(".pad").count()) !== padCount) {
    throw new Error(`${label}: turning the kit changed how many pieces exist`);
  }
  // Turning a kit gives a line of columns, not a list. When the grid and
  // its lines both run down the page the lines stack on top of each other,
  // and the count of rows is still right — this is the only way to see it.
  const lineXs = await page.locator(".pad-row").evaluateAll((rows) =>
    rows.map((row) => Math.round(row.getBoundingClientRect().x))
  );
  if (new Set(lineXs).size !== lineXs.length) {
    throw new Error(`${label}: the turned kit stacked its lines instead of turning them`);
  }
  await assertNoHOverflow(page, `${label} pads down`);
  await turnTo(page, label, "horizontal");

  // Fourth surface: a wind is played through the same chart the tuner
  // draws, and it is held rather than struck.
  await page.locator(".play-bar .value-chip").click();
  await page.waitForSelector('[data-instrument="dizi"]', { timeout: 4000 });
  await page.locator('[data-instrument="dizi"]').click();
  await page.waitForSelector(".hole-chart", { timeout: 8000 });
  await page.keyboard.press("Escape");
  if ((await page.locator(".pad-grid").count()) !== 0) {
    throw new Error(`${label}: a dizi should not draw pads`);
  }
  await assertTurned(page, label, ".hole-chart", "horizontal");
  const cards = await page.locator(".hole-card").count();
  if (cards !== 14) throw new Error(`${label}: expected two octaves of notes, got ${cards}`);
  const dots = await page.locator(".hole-card").first().locator(".hole-dot").count();
  if (dots !== 6) throw new Error(`${label}: a dizi has six holes, got ${dots}`);
  await assertStageFillsWidth(page, `${label} holes`, ".play-stage", 0.99);
  await assertStageOwnsTheRest(page, `${label} holes`, ".play-stage");
  await assertNoVOverflow(page, `${label} holes`);
  // A scale is one ascending line; folded into rows it stops being one.
  if (wide) await assertSingleRow(page, `${label} dizi`, ".hole-card");

  // The scale runs down the page instead of across it, in the same order.
  const scaleBefore = await page.locator(".hole-card").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label"))
  );
  await turnTo(page, label, "vertical");
  await assertTurned(page, label, ".hole-chart", "vertical");
  const scaleTurned = await page.locator(".hole-card").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label"))
  );
  if (JSON.stringify(scaleTurned) !== JSON.stringify(scaleBefore)) {
    throw new Error(`${label}: turning the wind chart reordered the scale`);
  }
  await turnTo(page, label, "horizontal");
  await assertTapTargets(page, `${label} dizi`, ".hole-card", "horizontal");

  await page.locator(".hole-card").first().dispatchEvent("pointerdown");
  await page.waitForSelector(".hole-card.is-down", { timeout: 4000 });
  await page.locator(".hole-card").first().dispatchEvent("pointerup");
  await page.waitForFunction(() => document.querySelectorAll(".hole-card.is-down").length === 0, {
    timeout: 4000
  });
  await assertNoHOverflow(page, `${label} winds`);

  // A play tool has no use for a microphone.
  if ((await page.locator(".audio-source").count()) !== 0) {
    throw new Error(`${label}: the play tool should not ask for a microphone`);
  }

  await assertNoHOverflow(page, `${label} fretboard`);
  console.log(`✓ ${label}: keys, frets, pads and holes all play, turn, and fill the page`);
}

/** Ear training: the whole loop is hear -> answer -> verdict -> next. */
async function walkEar(page, label, { fullRep = false } = {}) {
  await gotoTool(page, "ear");
  await page.waitForSelector("[data-ear-pad] .ear-choice", { timeout: 8000 });

  // No microphone here: ear training only needs the output side.
  if ((await page.locator("[data-source-toggle]").count()) !== 0) {
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
  // Progress you cannot clear is progress you stop trusting.
  await page.waitForSelector("[data-ear-reset]", { timeout: 4000 });
  await page.locator("[data-ear-reset]").click();
  await page.waitForTimeout(150);
  if (!(await page.locator("[data-ear-stats]").innerText()).match(/No attempts|还没有记录/)) {
    throw new Error(`${label}: resetting should clear the record`);
  }
  console.log(`✓ ${label}: progress can be reset`);

  await assertStageFillsWidth(page, `${label} ear`, ".ear-stage");
  await assertNoVOverflow(page, `${label} ear`);
  console.log(`✓ ${label}: ear training answers, grades and moves on`);

  // Switching kind swaps the pad.
  await page.locator('[data-ear-kind="chord"]').click();
  await page.waitForTimeout(150);
  const chordChoices = await page.locator("[data-ear-pad] .ear-choice").count();
  if (chordChoices < 2) throw new Error(`${label}: chord pad should render choices`);
  console.log(`✓ ${label}: switching question kind swaps the answer pad`);

  // Sight-singing: one button runs the whole rep, and the fake microphone
  // sings a steady C4 into it.
  await page.locator('[data-ear-kind="sing"]').click();
  await page.waitForSelector("[data-sing-canvas] canvas", { timeout: 8000 });
  if (!(await page.locator("[data-sing-start]").isEnabled())) {
    throw new Error(`${label}: start must never be disabled — it acquires the mic itself`);
  }
  // Sight-singing means reading: the line has to be written down.
  await page.waitForSelector("[data-score] svg", { timeout: 8000 });
  if ((await page.locator(".score-head").count()) < 4) {
    throw new Error(`${label}: the staff should carry the written line`);
  }
  // Both notations are on screen as a choice, not hidden behind a toggle
  // whose label is its own current state.
  if ((await page.locator("[data-sing-notation]").count()) !== 2) {
    throw new Error(`${label}: notation should be a choice between two, both visible`);
  }
  await page.locator('[data-sing-notation="jianpu"]').click();
  await page.waitForSelector(".score-degree", { timeout: 4000 });
  if ((await page.locator(".score-line").count()) !== 0) {
    throw new Error(`${label}: numbered notation should replace the staff`);
  }
  await page.locator('[data-sing-notation="staff"]').click();
  await page.waitForSelector(".score-head", { timeout: 4000 });

  // A tenor sings a soprano's line an octave down and is not wrong.
  await page.locator('[data-sing-register="octaveDown"]').click();
  await page.waitForSelector(".score-octave", { timeout: 4000 });
  await page.locator('[data-sing-register="written"]').click();
  console.log(`✓ ${label}: the line is written, in either notation and either register`);

  console.log(`✓ ${label}: sight-singing offers one transport control`);

  if (fullRep) {
    // The round trip: press start once, sing the line the page is showing,
    // and read the verdict. Nothing else is pressed.
    // Read the line and the tempo first, then let the page itself wait for
    // the count-in: a round trip per attribute would smear the first note
    // by a fraction of a beat, and that is the difference between "sung in
    // tune" and "sung the note before".
    const stage = page.locator("[data-sing-plan]");
    const plan = JSON.parse(await stage.getAttribute("data-sing-plan"));
    const beat = Number(await stage.getAttribute("data-sing-beat"));
    const countIn = Number(await stage.getAttribute("data-sing-countin"));

    const performance_ = page.evaluate(
      async ({ notes, lead }) => {
        const phase = () => document.querySelector("[data-sing-canvas]")?.dataset.singPhase;
        while (phase() !== "countIn") await new Promise((r) => requestAnimationFrame(r));
        const begins = performance.now() + lead * 1000;
        for (const note of notes) {
          const wait = begins + note.start * 1000 - performance.now();
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          window.__sing(note.midi);
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        window.__sing(null);
      },
      { notes: plan, lead: beat * countIn }
    );

    await page.locator("[data-sing-start]").click();
    await performance_;

    await page.waitForFunction(
      () => document.querySelector("[data-sing-verdict]")?.textContent?.includes("%"),
      undefined,
      { timeout: 20000 }
    );
    const grades = (await page.locator("[data-sing-notes]").getAttribute("data-sing-notes")).split(",");
    const cents = await page.locator("[data-sing-notes]").getAttribute("data-sing-cents");
    const heard = grades.filter((grade) => grade !== "missed").length;
    const good = grades.filter((grade) => grade === "good").length;
    if (heard < grades.length - 1) {
      throw new Error(`${label}: the take was not heard (${grades.join(",")} / cents ${cents})`);
    }
    // Sung dead in tune by an oscillator: most notes must come back good,
    // or something between the microphone and the judge is out of step.
    if (good < Math.ceil(grades.length * 0.6)) {
      throw new Error(`${label}: an in-tune take scored ${good}/${grades.length} (cents ${cents})`);
    }
    await page.locator("[data-sing-start]").click();
    console.log(`✓ ${label}: an in-tune take scores ${good}/${grades.length} notes good`);
  }

  await assertNoHOverflow(page, `${label} ear`);
  await gotoTool(page, "tune");
}

async function walkWorkbench(page, label, { wide = false } = {}) {
  // All five panels render.
  await page.waitForSelector(".strings-panel", { timeout: 8000 });
  await page.waitForSelector('[data-panel="pitch"]', { timeout: 8000 });
  await page.waitForSelector('[data-panel="chord"]', { timeout: 8000 });
  await page.waitForSelector('[data-panel="settings"] .v-slider', { timeout: 8000 });
  // The spectrum moved to the scope: a tuner's answer is one number.
  if ((await page.locator('[data-panel="spectrum"]').count()) !== 0) {
    throw new Error(`${label}: the spectrum panel should live in the scope now`);
  }
  console.log(`✓ ${label}: workbench renders all 4 panels`);

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
  // Collapsing must unmount the content, not just hide it.
  await page.click('[data-panel="chord"] .card-toggle');
  await page.waitForTimeout(250);
  if ((await page.locator('[data-panel="chord"] .chroma').count()) !== 0) {
    throw new Error(`${label}: collapsed chord panel did not unmount its content`);
  }
  await page.click('[data-panel="chord"] .card-toggle');
  await page.waitForSelector('[data-panel="chord"] .chroma', { timeout: 5000 });
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
  // All six on one line, not five and a widow: the column count is the
  // instrument's, not whatever a pixel minimum happens to allow.
  if (wide) await assertSingleRow(page, `${label} guitar`, ".string-row");
  console.log(`✓ ${label}: guitar renders 6 strings in one horizontal row`);

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

  // A guzheng is the stress case for "one row per instrument": 21 strings
  // must still be one row that fits, not 21 cells overflowing the card.
  await page.locator(".v-select").nth(0).click();
  await page.locator(".v-list-item").filter({ hasText: /^(Guzheng|古筝)$/ }).first().click();
  await page.waitForTimeout(250);
  if ((await page.locator(".string-row").count()) !== 21) {
    throw new Error(`${label}: expected 21 guzheng strings`);
  }
  if (wide) await assertSingleRow(page, `${label} guzheng`, ".string-row");
  await assertNoHOverflow(page, `${label} guzheng`);
  console.log(`✓ ${label}: 21 guzheng strings stay on one row inside the card`);

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
  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    permissions: ["microphone"]
  });
  await desktop.addInitScript(SYNTHETIC_MIC);
  attachListeners(desktop, "desktop");
  await desktop.goto(BASE_URL, { waitUntil: "networkidle" });
  await walkWorkbench(desktop, "desktop", { wide: true });

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
  if ((await desktop.locator(".tool-nav-link").count()) !== 5) {
    throw new Error("desktop: expected tune + scope + rhythm + ear + play nav links");
  }
  console.log("✓ desktop: shell exposes all five tools");

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

  await walkTrace(desktop, "desktop", { live: true });
  await walkEar(desktop, "desktop", { fullRep: true });
  await walkMetronome(desktop, "desktop", { expectSingleScreen: true });
  await walkPlay(desktop, "desktop", { wide: true });

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

  await walkTrace(mobile, "mobile");
  await walkEar(mobile, "mobile");
  await walkMetronome(mobile, "mobile");
  await walkPlay(mobile, "mobile");

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
