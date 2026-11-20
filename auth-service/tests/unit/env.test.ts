import type { env as Env } from '../../src/config/env';

// src/config/env.ts validates process.env once, at import time, and exits the
// process on failure; load it in isolation with a given environment.
function loadEnv(overrides: Record<string, string | undefined>): typeof Env {
  const saved = { ...process.env };
  Object.assign(process.env, overrides);
  const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${String(code)})`);
  });
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    let loaded: typeof Env | undefined;
    jest.isolateModules(() => {
      loaded =
        jest.requireActual<typeof import('../../src/config/env')>('../../src/config/env').env;
    });
    return loaded!;
  } finally {
    process.env = saved;
    exit.mockRestore();
    error.mockRestore();
  }
}

describe('environment validation', () => {
  it('refuses to start in production with a short JWT secret', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'changeme-secret',
        JWT_REFRESH_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      }),
    ).toThrow('process.exit(1)');
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        JWT_REFRESH_SECRET: 'changeme-secret',
      }),
    ).toThrow('process.exit(1)');
  });

  it('accepts long JWT secrets in production', () => {
    const loaded = loadEnv({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      JWT_REFRESH_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    expect(loaded.NODE_ENV).toBe('production');
  });

  it('allows short secrets outside production', () => {
    const loaded = loadEnv({
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    });

    expect(loaded.JWT_ACCESS_SECRET).toBe('short');
  });

  it('treats an empty ADMIN_PASSWORD as not set', () => {
    const loaded = loadEnv({ ADMIN_EMAIL: '', ADMIN_PASSWORD: '' });

    expect(loaded.ADMIN_EMAIL).toBeUndefined();
    expect(loaded.ADMIN_PASSWORD).toBeUndefined();
  });
});
