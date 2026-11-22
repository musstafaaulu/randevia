// Reuses the Chromium that `web/`'s Playwright install already downloaded
// for the e2e suite, instead of adding a second dependency/browser download
// just for this script.
export { chromium } from '../../../web/node_modules/playwright/index.mjs';

// Moves the mouse in many small steps with a short pause between each, so
// cursor motion reads as a human pointing rather than an instant teleport or
// a handful of visible jumps. (A real higher-capture-rate recording was
// tried - CDP screencast and a tight screenshot-polling loop both measured
// ~25-28fps in this environment, no better than Playwright's own video
// recorder - so smoothness here, plus ffmpeg's motion-compensated
// interpolation in 07-assemble.mjs, is what actually buys fluid motion.)
export async function humanMove(page, x, y, { steps = 40 } = {}) {
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(120);
}

export async function humanClick(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
  }
  await locator.click();
  await page.waitForTimeout(400);
}

export async function humanType(page, locator, text) {
  await locator.click();
  await page.waitForTimeout(200);
  await locator.pressSequentially(text, { delay: 85 });
  await page.waitForTimeout(300);
}

// Eased (slow -> fast -> slow) wheel scroll in many small increments instead
// of a few big jumps, so the motion itself is smooth before any video
// post-processing even runs.
export async function humanScroll(page, totalPx, steps = 30, pauseMs = 40) {
  for (let i = 0; i < steps; i++) {
    const progress = (i + 0.5) / steps;
    // ease-in-out: slow at the ends, faster in the middle.
    const ease = Math.sin(progress * Math.PI);
    const step = (totalPx / steps) * (0.4 + 1.2 * ease);
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(pauseMs);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
