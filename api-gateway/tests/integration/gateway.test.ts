import type { Application } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env, GatewayConfig } from '../../src/config/env';
import { startUpstream, Upstream, unusedUrl } from '../utils/upstream';

let auth: Upstream;
let appointment: Upstream;
let notification: Upstream;

function buildApp(overrides: Partial<GatewayConfig> = {}): Application {
  return createApp({
    ...env,
    AUTH_SERVICE_URL: auth.url,
    APPOINTMENT_SERVICE_URL: appointment.url,
    NOTIFICATION_SERVICE_URL: notification.url,
    ...overrides,
  });
}

beforeAll(async () => {
  [auth, appointment, notification] = await Promise.all([
    startUpstream('auth-service'),
    startUpstream('appointment-service'),
    startUpstream('notification-service'),
  ]);
});

afterAll(async () => {
  await Promise.all([auth.close(), appointment.close(), notification.close()]);
});

describe('routing', () => {
  it.each([
    ['/api/v1/auth/me', 'auth-service'],
    ['/api/v1/auth/users/123/role', 'auth-service'],
    ['/api/v1/doctors', 'appointment-service'],
    ['/api/v1/doctors/abc', 'appointment-service'],
    ['/api/v1/appointments/me', 'appointment-service'],
    ['/api/v1/notifications/me?page=2&limit=5', 'notification-service'],
  ])('forwards %s to %s with the path unchanged', async (path, service) => {
    const res = await request(buildApp()).get(path);

    expect(res.status).toBe(200);
    expect(res.body.service).toBe(service);
    expect(res.body.url).toBe(path);
  });

  it('streams the request body and the Authorization header through', async () => {
    const res = await request(buildApp())
      .post('/api/v1/appointments')
      .set('Authorization', 'Bearer some-token')
      .send({ doctorId: 'd1', date: '2030-01-01T10:00:00.000Z' });

    expect(res.body.method).toBe('POST');
    expect(res.body.headers.authorization).toBe('Bearer some-token');
    expect(res.body.body).toEqual({ doctorId: 'd1', date: '2030-01-01T10:00:00.000Z' });
  });

  it('passes upstream status codes and Set-Cookie headers back to the client', async () => {
    const res = await request(buildApp()).get('/api/v1/auth/me').set('x-test-status', '401');

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']?.[0]).toContain('refreshToken=abc');
  });

  it('adds X-Forwarded-For so services can see the client', async () => {
    const res = await request(buildApp()).get('/api/v1/doctors');

    expect(res.body.headers['x-forwarded-for']).toBeDefined();
  });

  it('does not match look-alike prefixes', async () => {
    const res = await request(buildApp()).get('/api/v1/authors');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, requestId: expect.any(String) });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(buildApp()).get('/api/v2/whatever');

    expect(res.status).toBe(404);
  });
});

describe('request id', () => {
  it('generates an id, returns it and forwards it upstream', async () => {
    const res = await request(buildApp()).get('/api/v1/doctors');

    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.headers['x-request-id']).toBe(id);
  });

  it('keeps a valid id supplied by the caller', async () => {
    const res = await request(buildApp()).get('/api/v1/doctors').set('X-Request-Id', 'trace-42');

    expect(res.headers['x-request-id']).toBe('trace-42');
    expect(res.body.headers['x-request-id']).toBe('trace-42');
  });

  it('replaces an unsafe id supplied by the caller', async () => {
    const res = await request(buildApp())
      .get('/api/v1/doctors')
      .set('X-Request-Id', 'bad id with spaces <script>');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('security headers and CORS', () => {
  it('sets helmet headers', async () => {
    const res = await request(buildApp()).get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers preflight requests itself for an allowed origin', async () => {
    const res = await request(buildApp({ CORS_ORIGIN: 'http://app.example, http://admin.example' }))
      .options('/api/v1/appointments')
      .set('Origin', 'http://admin.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://admin.example');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('replaces upstream CORS headers with the gateway policy', async () => {
    const res = await request(buildApp({ CORS_ORIGIN: 'http://app.example' }))
      .get('/api/v1/doctors')
      .set('Origin', 'http://app.example');

    expect(res.headers['access-control-allow-origin']).toBe('http://app.example');
    expect(res.headers['access-control-expose-headers']).toBe('X-Request-Id');
  });

  it('does not allow an origin that is not on the list', async () => {
    const res = await request(buildApp({ CORS_ORIGIN: 'http://app.example' }))
      .get('/api/v1/doctors')
      .set('Origin', 'http://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows any origin, without credentials, for *', async () => {
    const res = await request(buildApp({ CORS_ORIGIN: '*' }))
      .get('/api/v1/doctors')
      .set('Origin', 'http://anything.example');

    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('limits requests per client and answers 429 as JSON', async () => {
    const app = buildApp({ RATE_LIMIT_MAX: 2 });

    await request(app).get('/api/v1/doctors').expect(200);
    await request(app).get('/api/v1/doctors').expect(200);
    const res = await request(app).get('/api/v1/doctors');

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, requestId: expect.any(String) });
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it('applies a stricter limit to credential endpoints', async () => {
    const app = buildApp({ RATE_LIMIT_MAX: 100, AUTH_RATE_LIMIT_MAX: 1 });

    await request(app).post('/api/v1/auth/login').send({}).expect(200);
    await request(app).post('/api/v1/auth/login').send({}).expect(429);
    // Other auth routes are only subject to the global limit.
    await request(app).get('/api/v1/auth/me').expect(200);
  });

  it('never rate-limits health checks', async () => {
    const app = buildApp({ RATE_LIMIT_MAX: 1 });

    for (let i = 0; i < 3; i += 1) await request(app).get('/api/v1/health').expect(200);
  });
});

describe('upstream failures', () => {
  it('answers 502 when a service is unreachable', async () => {
    const app = buildApp({ NOTIFICATION_SERVICE_URL: await unusedUrl() });

    const res = await request(app).get('/api/v1/notifications/me');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      success: false,
      message: 'notification-service şu anda kullanılamıyor',
      requestId: res.headers['x-request-id'],
    });
  });

  it('answers 504 when a service does not respond in time', async () => {
    const app = buildApp({ PROXY_TIMEOUT_MS: 100 });

    const res = await request(app).get('/api/v1/doctors/slow');

    expect(res.status).toBe(504);
    expect(res.body.message).toBe('appointment-service zamanında yanıt vermedi');
  });
});

describe('health', () => {
  it('reports the gateway as alive', async () => {
    const res = await request(buildApp()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, service: 'api-gateway', status: 'ok' });
  });

  it('reports every service as up', async () => {
    const res = await request(buildApp()).get('/api/v1/health/services');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Object.keys(res.body.services).sort()).toEqual([
      'appointment-service',
      'auth-service',
      'notification-service',
    ]);
    expect(res.body.services['auth-service'].status).toBe('up');
  });

  it('answers 503 when a service is down', async () => {
    const app = buildApp({ APPOINTMENT_SERVICE_URL: await unusedUrl() });

    const res = await request(app).get('/api/v1/health/services');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services['appointment-service'].status).toBe('down');
    expect(res.body.services['auth-service'].status).toBe('up');
  });
});
