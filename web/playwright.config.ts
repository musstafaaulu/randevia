import { defineConfig } from '@playwright/test';

// Runs against the real backend from docker-compose (`docker compose up`).
// By default it drives a Vite dev server for the UI; set E2E_BASE_URL to
// point it at the dockerized nginx build (e.g. http://localhost:8080)
// instead. See e2e/README for the one-time setup (CORS_ORIGIN must include
// whichever origin is used).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  // Seeded users/doctors live in the real database (see e2e/helpers.ts);
  // remove them again once the run finishes, pass or fail.
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
