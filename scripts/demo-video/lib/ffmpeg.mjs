import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORK_DIR = path.join(REPO_ROOT, 'docs', 'demo-video');
const FFMPEG_IMAGE = 'mwader/static-ffmpeg:latest';

// Runs ffmpeg inside the Docker image (no local ffmpeg install needed).
// `args` are plain ffmpeg arguments using paths relative to docs/demo-video/
// (that directory is mounted at /work inside the container).
export function ffmpeg(args, { quiet = true } = {}) {
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${WORK_DIR}:/work`,
    '-w',
    '/work',
    '--entrypoint',
    '/ffmpeg',
    FFMPEG_IMAGE,
    '-y',
    '-hide_banner',
    ...(quiet ? ['-loglevel', 'error'] : []),
    ...args,
  ];
  const result = spawnSync('docker', dockerArgs, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`ffmpeg failed (exit ${result.status}): ${args.join(' ')}`);
  }
  return result;
}

export function ffprobe(args) {
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${WORK_DIR}:/work`,
    '-w',
    '/work',
    '--entrypoint',
    '/ffprobe',
    FFMPEG_IMAGE,
    ...args,
  ];
  const result = spawnSync('docker', dockerArgs, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr);
    throw new Error(`ffprobe failed: ${args.join(' ')}`);
  }
  return result.stdout;
}

export { WORK_DIR, REPO_ROOT };
