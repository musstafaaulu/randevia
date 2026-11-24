import fs from 'node:fs';
import path from 'node:path';
import { WORK_DIR } from './ffmpeg.mjs';

const PAN_DIR = path.join(WORK_DIR, 'raw', 'pans');
fs.mkdirSync(PAN_DIR, { recursive: true });

const counters = {};

// Use this in place of a real scroll gesture for any "the camera glides
// through the content" moment. A real mouse-wheel scroll, captured in
// Playwright's ~25-28fps video and then upsampled, is exactly what left
// visible ghosting in scroll scenes (see 07-assemble.mjs's old
// minterpolate=blend step). Instead: take one full-page screenshot (a
// single sharp raster - scrolling never touches the actual pixels), jump
// the real page to the destination instantly (this shows up as one ugly
// cut in the raw recording, which 07-assemble.mjs later excises), and leave
// a marker so it can synthesize a genuinely smooth pan across that
// screenshot afterwards: every output frame is a distinct crop of one real
// image, so there is nothing to interpolate and nothing to smear.
export async function scrollPan(page, timeline, id, distance, durationMs = 1800) {
  const viewport = page.viewportSize();
  const startY = await page.evaluate(() => window.scrollY);
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const maxY = Math.max(0, pageHeight - viewport.height);
  const endY = Math.min(maxY, Math.max(0, startY + distance));

  const index = (counters[id] = (counters[id] ?? 0) + 1);
  const fileName = `${id}-${index}.png`;
  await page.screenshot({ path: path.join(PAN_DIR, fileName), fullPage: true });

  timeline.markPan({
    file: `raw/pans/${fileName}`,
    startMs: timeline.elapsedMs(),
    durationMs,
    startY,
    endY,
    viewport,
  });

  await page.evaluate((y) => window.scrollTo(0, y), endY);
  await page.waitForTimeout(durationMs);
}
