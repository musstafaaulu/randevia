import path from 'node:path';
import { chromium } from './lib/browser.mjs';
import { renderHtml, captionHtml } from './lib/render.mjs';
import { WORK_DIR } from './lib/ffmpeg.mjs';
import { SCENES } from './scenes.mjs';

const RAW = path.join(WORK_DIR, 'raw', 'captions');

async function main() {
  const browser = await chromium.launch();
  for (const scene of SCENES) {
    for (const lang of ['tr', 'en']) {
      await renderHtml(browser, captionHtml(scene[lang]), path.join(RAW, `${scene.id}-${lang}.png`), {
        transparent: true,
      });
    }
  }
  await browser.close();
  console.log(`captions built for ${SCENES.length} scenes x 2 languages.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
