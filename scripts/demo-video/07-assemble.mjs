import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, WORK_DIR } from './lib/ffmpeg.mjs';
import { SCENES } from './scenes.mjs';

const CLIPS_DIR = path.join(WORK_DIR, 'clips');
const FINAL_DIR = path.join(WORK_DIR, 'final');
fs.mkdirSync(CLIPS_DIR, { recursive: true });
fs.mkdirSync(FINAL_DIR, { recursive: true });

function combineSplit() {
  ffmpeg([
    '-i', 'raw/02-split-patient.webm',
    '-i', 'raw/02-split-doctor.webm',
    '-filter_complex', '[0:v][1:v]hstack=inputs=2,fps=30,format=yuv420p[v]',
    '-map', '[v]',
    '-c:v', 'libx264',
    'raw/02-split-screen-rezervasyon.mp4',
  ]);
}

// Normalizes one raw scene recording to a consistent 1920x1080@30fps H.264
// clip with no audio track, padding (not stretching) anything smaller - the
// mobile scene is recorded at phone size, so it gets centered on the app's
// own dark brand color instead of being blown up to full width.
function normalize(id, inputFile) {
  const out = `clips/${id}-norm.mp4`;
  ffmpeg([
    '-i', inputFile,
    '-vf',
    'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-an',
    out,
  ]);
  return out;
}

function overlayCaption(normMp4, id, lang) {
  const out = `clips/${id}-${lang}.mp4`;
  ffmpeg([
    '-i', normMp4,
    '-i', `raw/captions/${id}-${lang}.png`,
    '-filter_complex', '[0:v][1:v]overlay=0:0,format=yuv420p[v]',
    '-map', '[v]',
    '-c:v', 'libx264',
    out,
  ]);
  return out;
}

function concat(lang, clipList) {
  const listPath = path.join(WORK_DIR, `concat-${lang}.txt`);
  fs.writeFileSync(listPath, clipList.map((c) => `file '${c}'`).join('\n'));
  ffmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', `concat-${lang}.txt`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    `final/randevia-demo-${lang}.mp4`,
  ]);
  fs.rmSync(listPath);
}

async function main() {
  console.log('combining split-screen scene...');
  combineSplit();

  const rawFiles = {
    '01-tanitim-giris-arama': 'raw/01-tanitim-giris-arama.webm',
    '02-split-screen-rezervasyon': 'raw/02-split-screen-rezervasyon.mp4',
    '03-randevularim-ics': 'raw/03-randevularim-ics.webm',
    '04a-tema': 'raw/04a-tema.webm',
    '04b-mobil': 'raw/04b-mobil.webm',
    '05-admin-panel': 'raw/05-admin-panel.webm',
    '06-teknik': 'raw/06-teknik.webm',
  };

  console.log('normalizing scenes...');
  const normByScene = {};
  for (const scene of SCENES) {
    console.log(` - ${scene.id}`);
    normByScene[scene.id] = normalize(scene.id, rawFiles[scene.id]);
  }

  for (const lang of ['tr', 'en']) {
    console.log(`overlaying captions (${lang})...`);
    const finalClips = [`clips/00-intro-${lang}.mp4`];
    for (const scene of SCENES) {
      console.log(`   - ${scene.id}`);
      finalClips.push(overlayCaption(normByScene[scene.id], scene.id, lang));
    }
    finalClips.push(`clips/07-outro-${lang}.mp4`);

    console.log(`concatenating final video (${lang})...`);
    concat(lang, finalClips);
  }

  console.log('done: final/randevia-demo-tr.mp4, final/randevia-demo-en.mp4');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
