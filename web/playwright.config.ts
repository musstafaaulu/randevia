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
  // One worker process: specs share the admin-token cache in helpers.ts
  // (each login/register call counts against the gateway's credential rate
  // limit, so reusing one admin session across every spec file matters) and
  // a single worker keeps that cache meaningful.
  workers: 1,
  retries: 0,
  reporter: 'list',
  // Resets the gateway/services' in-memory rate limiters before the run
  // (see global-setup.ts) ...
  globalSetup: './e2e/global-setup.ts',
  // ... and, seeded users/doctors living in the real database (see
  // e2e/helpers.ts), removes them again once the run finishes, pass or fail.
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
