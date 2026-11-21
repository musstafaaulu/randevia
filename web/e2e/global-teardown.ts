import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// helpers.ts seeds its patient/doctor straight against the live gateway (see
// its own comment for why), so this suite leaves real rows behind in the
// shared database just like scripts/e2e.mjs does. Reuse the same cleanup
// script here so a Playwright run never leaves test data lying around.
export default function globalTeardown(): void {
  const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');
  const result = spawnSync('node', ['clean-test-data.mjs'], { cwd: scriptsDir, stdio: 'inherit' });
  if (result.status !== 0) {
    console.warn('clean-test-data.mjs failed during Playwright global teardown; test data may remain.');
  }
}
