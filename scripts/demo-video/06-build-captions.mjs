import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './lib/browser.mjs';
import { renderHtml, captionHtml } from './lib/render.mjs';
import { WORK_DIR } from './lib/ffmpeg.mjs';
import { SCENE_IDS } from './scenes.mjs';

const RAW = path.join(WORK_DIR, 'raw');
const CAPTIONS_DIR = path.join(RAW, 'captions');

async function main() {
  const browser = await chromium.launch();
  let total = 0;

  for (const id of SCENE_IDS) {
    const eventsPath = path.join(RAW, `${id}-events.json`);
    if (!fs.existsSync(eventsPath)) {
      console.warn(`no events file for ${id}, skipping captions`);
      continue;
    }
    const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    for (const [index, event] of events.entries()) {
      for (const lang of ['tr', 'en']) {
        const text = lang === 'tr' ? event.tr : event.en;
        const out = path.join(CAPTIONS_DIR, `${id}-${index}-${lang}.png`);
        await renderHtml(browser, captionHtml({ title: text }), out, { transparent: true });
        total += 1;
      }
    }
  }

  await browser.close();
  console.log(`captions built: ${total} PNGs across ${SCENE_IDS.length} scenes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
