import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Component/unit tests only; the Playwright suite in e2e/ covers the real
// backend and is run separately (npm run test:e2e), not by this config.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Needed so @testing-library/react's auto-cleanup (registered via the
    // global afterEach) runs between tests, even though test files import
    // describe/it/expect explicitly instead of relying on globals.
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
