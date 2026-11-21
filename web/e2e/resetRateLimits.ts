import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE_LIMITED_SERVICES = [
  'api-gateway',
  'auth-service',
  'appointment-service',
  'notification-service',
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sleepSync(ms: number): void {
  // Portable, synchronous sleep (no OS-specific sleep/timeout binary) - used
  // from a one-off setup/retry path, never inside a hot loop, so blocking
  // the event loop here is fine.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitUntilHealthy(service: string): void {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const status = execFileSync('docker', ['compose', 'ps', '--format', '{{.Health}}', service], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (status === 'healthy' || status === '') return; // no healthcheck defined counts as ready
    if (Date.now() > deadline) {
      console.warn(`${service} did not become healthy within 30s after restart; continuing anyway.`);
      return;
    }
    sleepSync(1000);
  }
}

// Every page load in this suite bootstraps auth state (GET /auth/me, and on
// its 401 a POST /auth/refresh - see web/src/api/client.ts), and each of
// those calls counts against the gateway's and the services' own
// express-rate-limit windows just like a real login/register would. A
// handful of spec files easily add up to more credential-endpoint calls than
// AUTH_RATE_LIMIT_MAX (20 per 15 minutes) allows. Restarting these
// containers resets their in-memory limiter state without touching any
// data, so callers use this both up front (globalSetup) and reactively,
// whenever a seed helper actually gets a 429 back.
export function resetRateLimitedServices(): boolean {
  const restart = spawnSync('docker', ['compose', 'restart', ...RATE_LIMITED_SERVICES], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (restart.status !== 0) {
    console.warn('Could not restart rate-limited services.');
    return false;
  }
  for (const service of RATE_LIMITED_SERVICES) waitUntilHealthy(service);
  return true;
}
