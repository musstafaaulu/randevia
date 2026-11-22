/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  // Floor, not a target: kept below the current measured coverage so CI
  // only fails on a real regression, not test-run noise.
  coverageThreshold: {
    global: { statements: 70, branches: 40, functions: 60, lines: 70 },
  },
  clearMocks: true,
};
