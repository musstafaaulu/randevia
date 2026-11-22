import path from 'node:path';
import { chromium } from './lib/browser.mjs';
import { renderHtml, titleCardHtml, outroCardHtml } from './lib/render.mjs';
import { ffmpeg, WORK_DIR } from './lib/ffmpeg.mjs';

const RAW = path.join(WORK_DIR, 'raw');

const TAGLINE = {
  tr: 'Gerçek zamanlı mikroservis randevu platformu',
  en: 'A real-time microservices appointment platform',
};
const BADGES = {
  tr: ['React 19', 'Node.js / TypeScript', 'RabbitMQ', 'Socket.io', 'Docker'],
  en: ['React 19', 'Node.js / TypeScript', 'RabbitMQ', 'Socket.io', 'Docker'],
};
const DEVELOPER = {
  tr: 'Geliştirici: Mustafa Ulu — Junior Full Stack Developer',
  en: 'Developer: Mustafa Ulu — Junior Full Stack Developer',
};

async function loopImageToVideo(pngPath, outName, seconds) {
  ffmpeg([
    '-loop', '1',
    '-i', pngPath,
    '-t', String(seconds),
    '-vf', `fps=60,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=${seconds - 0.5}:d=0.5`,
    '-c:v', 'libx264',
    `clips/${outName}`,
  ]);
}

async function main() {
  const browser = await chromium.launch();

  for (const lang of ['tr', 'en']) {
    await renderHtml(
      browser,
      titleCardHtml({ tagline: TAGLINE[lang], badges: BADGES[lang] }),
      path.join(RAW, `intro-${lang}.png`),
    );
    await renderHtml(
      browser,
      outroCardHtml({ developerLabel: DEVELOPER[lang] }),
      path.join(RAW, `outro-${lang}.png`),
    );
    await loopImageToVideo(`raw/intro-${lang}.png`, `00-intro-${lang}.mp4`, 3);
    await loopImageToVideo(`raw/outro-${lang}.png`, `07-outro-${lang}.mp4`, 4);
  }

  await browser.close();
  console.log('cards built.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
