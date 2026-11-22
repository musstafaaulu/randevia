import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './browser.mjs';
import { WORK_DIR } from './ffmpeg.mjs';
import { createTimeline } from './timeline.mjs';

const RAW_DIR = path.join(WORK_DIR, 'raw');

// Opens a fresh context with video recording on, runs `fn(page, context,
// timeline)` (timeline.log(tr, en) records a narration beat's real
// timestamp, relative to this context's creation - which is also when
// Playwright's own video recording clock starts), closes the context, then
// moves Playwright's randomly-named output file to raw/<id>.webm and the
// logged events to raw/<id>-events.json, so every later script can find
// both by scene id.
export async function recordScene(
  id,
  fn,
  { viewport = { width: 1920, height: 1080 }, baseURL = 'http://localhost:8080' } = {},
) {
  const tmpDir = path.join(RAW_DIR, `_tmp-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: tmpDir, size: viewport },
    baseURL,
  });
  const timeline = createTimeline();
  const page = await context.newPage();

  try {
    await fn(page, context, timeline);
  } finally {
    await context.close();
    await browser.close();
  }

  const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.webm'));
  if (files.length === 0) throw new Error(`No video produced for scene ${id}`);
  const dest = path.join(RAW_DIR, `${id}.webm`);
  fs.copyFileSync(path.join(tmpDir, files[0]), dest);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const eventsPath = path.join(RAW_DIR, `${id}-events.json`);
  fs.writeFileSync(eventsPath, JSON.stringify(timeline.events, null, 2));

  console.log(`recorded ${id} -> ${dest} (${timeline.events.length} caption events)`);
  return dest;
}

export { chromium };
