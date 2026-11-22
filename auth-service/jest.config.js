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
  // Floor, not a target: kept comfortably below the current ~90%/76%/91%/90%
  // so CI only fails on a real regression, not test-run noise.
  coverageThreshold: {
    global: { statements: 80, branches: 65, functions: 80, lines: 80 },
  },
  clearMocks: true,
};
