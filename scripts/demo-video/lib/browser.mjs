// Reuses the Chromium that `web/`'s Playwright install already downloaded
// for the e2e suite, instead of adding a second dependency/browser download
// just for this script.
export { chromium } from '../../../web/node_modules/playwright/index.mjs';

// Moves the mouse in several steps, pausing briefly, so cursor motion reads
// as a human pointing rather than an instant teleport.
export async function humanMove(page, x, y) {
  await page.mouse.move(x, y, { steps: 25 });
  await page.waitForTimeout(150);
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

export async function humanScroll(page, totalPx, steps = 10, pause = 180) {
  const step = totalPx / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(pause);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
