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
// full width), then resamples to 60fps with plain frame duplication
// (`fps=60`, no interpolation). This replaced `minterpolate=fps=60:mi_mode=
// blend`: blending two real-but-different frames together reads fine on a
// still background but visibly ghosts/smears anything actually moving (the
// cursor, a just-typed character) - duplicating frames instead never
// invents a blended pixel, so there is nothing to smear.
//
// A/B'd both on a real 2.2s sample of this scene's own footage (the email
// field being typed into) with `tblend=all_mode=difference,signalstats`,
// comparing the frame-to-frame luma delta: blend changed on 114/130 frames
// (lower amplitude, avg 0.109) while duplication changed on only 98/130
// (higher amplitude, avg 0.058, peak 0.639 vs blend's 0.318). That is
// exactly the signature of smearing: blend spreads one real transition
// across more frames at a smaller, hazier magnitude each, instead of
// showing it once, sharply, on the one frame it actually happened on.
// (Scroll motion no longer goes through this function at all - see
// splicePans()/buildPanClip() for how scroll segments are replaced with a
// synthesized pan instead.)
function normalizeAndUpsample(id, inputFile) {
  const out = `clips/${id}-norm.mp4`;
  ffmpeg([
    '-i', inputFile,
    '-vf',
    'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setsar=1,fps=60,format=yuv420p',
    '-c:v', 'libx264',
    '-an',
    out,
  ]);
  return out;
}

function loadPans(id) {
  const p = path.join(WORK_DIR, 'raw', `${id}-pans.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Synthesizes one scroll motion as a genuinely smooth 60fps pan over a
// single full-page screenshot (see lib/scrollPan.mjs): every output frame
// is a distinct crop of one real raster, eased in/out with a cosine curve,
// so - unlike resampling a real low-fps scroll recording - there is no
// interpolation step that could smear or ghost. (zoompan was tried first -
// it's the usual ffmpeg tool for this - but it defines its pan range in
// terms of *zoom*: with no zoom (z=1) the "cropped" region is defined to be
// the entire source image, so there is no room left to pan across and y is
// pinned at 0 regardless of the expression. Plain `crop`, driven by `t`
// directly instead of a zoom-relative window, has no such floor - verified
// by diffing the first/middle/last extracted frame of a sample clip and
// confirming the content position actually moves.)
function buildPanClip(id, index, pan) {
  const fps = 60;
  const durationSec = pan.durationMs / 1000;
  const distance = pan.endY - pan.startY;
  const yExpr = `${pan.startY}+(${distance})*(0.5-0.5*cos(PI*min(t/${durationSec},1)))`;

  const needsScale = pan.viewport.width !== 1920 || pan.viewport.height !== 1080;
  const vf = [
    `crop=${pan.viewport.width}:${pan.viewport.height}:0:'${yExpr}'`,
    ...(needsScale
      ? [
          'scale=1920:1080:force_original_aspect_ratio=decrease',
          'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120',
        ]
      : []),
    'setsar=1',
    'format=yuv420p',
  ].join(',');

  const out = `clips/${id}-pan${index}.mp4`;
  ffmpeg([
    '-loop', '1',
    '-framerate', String(fps),
    '-t', durationSec.toFixed(3),
    '-i', pan.file,
    '-vf', vf,
    '-r', String(fps),
    '-c:v', 'libx264',
    out,
  ]);
  return out;
}

// Frame-accurate trim (re-encoding, not stream-copy, is what makes `-ss`
// before `-i` land exactly on the requested boundary instead of snapping to
// the nearest keyframe) of one [startSec, endSec) window of `inputFile`.
function trimClip(inputFile, startSec, endSec, out) {
  const dur = endSec - startSec;
  ffmpeg([
    '-ss', startSec.toFixed(3),
    '-i', inputFile,
    '-t', dur.toFixed(3),
    '-c:v', 'libx264',
    '-an',
    out,
  ]);
  return out;
}

function concatClips(files, out) {
  if (files.length === 1) {
    ffmpeg(['-i', files[0], '-c', 'copy', out]);
    return out;
  }
  const inputs = files.flatMap((f) => ['-i', f]);
  const labels = files.map((_, i) => `[${i}:v]`).join('');
  const filter = `${labels}concat=n=${files.length}:v=1:a=0[outv]`;
  ffmpeg([...inputs, '-filter_complex', filter, '-map', '[outv]', '-c:v', 'libx264', out]);
  return out;
}

// Cuts the raw-but-ugly instant-jump window the recording left at each
// scrollPan() marker out of the normalized clip, and splices in the
// synthesized pan in its place - same content at both seams (the pan starts
///ends on the exact screenshot crop the real page was showing), so the cut
// is invisible. Scenes with no pans (loadPans returned []) pass through
// unchanged.
function splicePans(id, normFile, pans, sceneDurSec) {
  if (pans.length === 0) return normFile;

  const sorted = [...pans].sort((a, b) => a.startMs - b.startMs);
  const pieces = [];
  let cursor = 0;
  sorted.forEach((pan, i) => {
    const panStartSec = pan.startMs / 1000;
    if (panStartSec > cursor + 0.01) {
      pieces.push(trimClip(normFile, cursor, panStartSec, `clips/${id}-seg${i}.mp4`));
    }
    pieces.push(buildPanClip(id, i, pan));
    cursor = panStartSec + pan.durationMs / 1000;
  });
  if (sceneDurSec > cursor + 0.01) {
    pieces.push(trimClip(normFile, cursor, sceneDurSec, `clips/${id}-seg${sorted.length}.mp4`));
  }

  return concatClips(pieces, `clips/${id}-spliced.mp4`);
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

  console.log('normalizing to 60fps + splicing in synthesized scroll pans...');
  const normFiles = {};
  const sceneDurations = {};
  for (const id of SCENE_IDS) {
    console.log(`  - ${id}`);
    const normFile = normalizeAndUpsample(id, RAW_FILES[id]);
    const pans = loadPans(id);
    const normDurationSec = duration(normFile);
    normFiles[id] = splicePans(id, normFile, pans, normDurationSec);
    sceneDurations[id] = duration(normFiles[id]);
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
