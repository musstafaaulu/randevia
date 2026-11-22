import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, ffprobe, WORK_DIR } from './lib/ffmpeg.mjs';
import { SCENE_IDS } from './scenes.mjs';

const CLIPS_DIR = path.join(WORK_DIR, 'clips');
const FINAL_DIR = path.join(WORK_DIR, 'final');
fs.mkdirSync(CLIPS_DIR, { recursive: true });
fs.mkdirSync(FINAL_DIR, { recursive: true });

const XFADE = 0.7; // seconds, per scene-to-scene crossfade

function duration(containerRelativePath) {
  const out = ffprobe([
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    containerRelativePath,
  ]);
  return parseFloat(out);
}

function combineSplit() {
  ffmpeg([
    '-i', 'raw/02-split-patient.webm',
    '-i', 'raw/02-split-doctor.webm',
    '-filter_complex', '[0:v][1:v]hstack=inputs=2,format=yuv420p[v]',
    '-map', '[v]',
    '-c:v', 'libx264',
    'raw/02-split-screen-rezervasyon.mp4',
  ]);
}

// Scales/pads to a uniform 1920x1080 canvas (mobile's phone-sized recording
// gets centered on the app's own dark brand color instead of being blown up
// full width), then resamples to a smooth 60fps. `mi_mode=blend` (cross-
// dissolve between the real frames) was chosen over full motion-compensated
// interpolation (`mi_mode=mci`) after measuring: this environment's actual
// capture rate caps at ~25-28fps regardless of method (CDP screencast and a
// raw screenshot-polling loop were both tried and measured no better - see
// lib/browser.mjs) - motion-compensated interpolation is also far slower
// and can warp small fast-moving things like a cursor, which is most of
// what's moving here, where blend reliably reads as smooth with no risk of
// video and no warping artifacts.
function normalizeAndInterpolate(id, inputFile) {
  const out = `clips/${id}-norm.mp4`;
  ffmpeg([
    '-i', inputFile,
    '-vf',
    'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,minterpolate=fps=60:mi_mode=blend,format=yuv420p',
    '-c:v', 'libx264',
    '-an',
    out,
  ]);
  return out;
}

function loadEvents(id) {
  const p = path.join(WORK_DIR, 'raw', `${id}-events.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Burns in one time-windowed caption per logged narration beat: each shown
// from its real timestamp until the next beat's timestamp (capped at the
// scene's own end), so overlapping captions never stack on screen. Events
// were deliberately spaced >= ~3s apart in the recording scripts, so this
// also satisfies the "each caption stays up at least 3s" requirement in
// practice without ever truncating into the next one.
function overlayCaptions(normFile, id, lang, sceneDurSec) {
  const events = loadEvents(id);
  if (events.length === 0) return normFile;

  const inputs = ['-i', normFile];
  const windows = events.map((event, i) => {
    const start = event.t / 1000;
    const rawEnd = i + 1 < events.length ? events[i + 1].t / 1000 : sceneDurSec;
    inputs.push('-i', `raw/captions/${id}-${i}-${lang}.png`);
    return { start, end: Math.min(rawEnd, sceneDurSec) };
  });

  let filter = '';
  let prevLabel = '0:v';
  windows.forEach((w, i) => {
    const inLabel = `${i + 1}:v`;
    const isLast = i === windows.length - 1;
    const outLabel = isLast ? 'vout' : `v${i}`;
    const enable = `between(t,${w.start.toFixed(3)},${w.end.toFixed(3)})`;
    const tail = isLast ? ',format=yuv420p' : '';
    filter += `[${prevLabel}][${inLabel}]overlay=0:0:enable='${enable}'${tail}[${outLabel}];`;
    prevLabel = outLabel;
  });
  filter = filter.slice(0, -1);

  const out = `clips/${id}-${lang}.mp4`;
  ffmpeg([...inputs, '-filter_complex', filter, '-map', '[vout]', '-c:v', 'libx264', out]);
  return out;
}

// Chains an xfade crossfade between every consecutive pair of clips in one
// ffmpeg pass (hard cuts replaced by a 0.7s fade), computing each offset
// from the running (already-shortened-by-previous-crossfades) duration.
function crossfadeAll(lang, clipFiles) {
  const durations = clipFiles.map((f) => duration(f));
  const inputs = clipFiles.flatMap((f) => ['-i', f]);

  let filter = '';
  let prevLabel = '0:v';
  let accDur = durations[0];
  for (let i = 1; i < clipFiles.length; i++) {
    const offset = accDur - XFADE;
    const isLast = i === clipFiles.length - 1;
    const outLabel = isLast ? 'vfinal' : `xf${i}`;
    filter += `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${outLabel}];`;
    accDur = accDur + durations[i] - XFADE;
    prevLabel = outLabel;
  }
  filter = filter.slice(0, -1);

  const out = `final/video-${lang}-noaudio.mp4`;
  ffmpeg([...inputs, '-filter_complex', filter, '-map', '[vfinal]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out]);
  return { out, totalDuration: accDur };
}

function prepareMusic(totalDurationSec) {
  const fadeOutStart = Math.max(0, totalDurationSec - 2.2);
  ffmpeg([
    '-stream_loop', '-1',
    '-i', 'raw/music.wav',
    '-t', totalDurationSec.toFixed(2),
    '-af', `afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2.2,volume=0.32`,
    'final/music-trimmed.wav',
  ]);
  return 'final/music-trimmed.wav';
}

function mux(lang, videoFile, musicFile) {
  const out = `final/randevia-demo-${lang}.mp4`;
  ffmpeg([
    '-i', videoFile,
    '-i', musicFile,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    '-shortest',
    out,
  ]);
  return out;
}

const RAW_FILES = {
  '01-tanitim-giris-arama': 'raw/01-tanitim-giris-arama.webm',
  '02-split-screen-rezervasyon': 'raw/02-split-screen-rezervasyon.mp4',
  '03-randevularim-ics': 'raw/03-randevularim-ics.webm',
  '04a-tema': 'raw/04a-tema.webm',
  '04b-mobil': 'raw/04b-mobil.webm',
  '05-admin-panel': 'raw/05-admin-panel.webm',
  '06-teknik': 'raw/06-teknik.webm',
};

async function main() {
  console.log('combining split-screen scene...');
  combineSplit();

  console.log('normalizing + interpolating to 60fps...');
  const normFiles = {};
  const sceneDurations = {};
  for (const id of SCENE_IDS) {
    console.log(`  - ${id}`);
    sceneDurations[id] = duration(RAW_FILES[id]);
    normFiles[id] = normalizeAndInterpolate(id, RAW_FILES[id]);
  }

  for (const lang of ['tr', 'en']) {
    console.log(`building ${lang} captions + crossfades...`);
    const clips = [`clips/00-intro-${lang}.mp4`];
    for (const id of SCENE_IDS) {
      console.log(`  - ${id}`);
      clips.push(overlayCaptions(normFiles[id], id, lang, sceneDurations[id]));
    }
    clips.push(`clips/07-outro-${lang}.mp4`);

    console.log(`  crossfading ${clips.length} clips...`);
    const { out: videoNoAudio, totalDuration } = crossfadeAll(lang, clips);
    console.log(`  total duration: ${totalDuration.toFixed(1)}s`);

    console.log('  preparing music track...');
    const music = prepareMusic(totalDuration);

    console.log('  muxing final video...');
    const final = mux(lang, videoNoAudio, music);
    console.log(`done: ${final}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
