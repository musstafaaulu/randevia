import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/health', () => {
  it('returns service status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, service: 'appointment-service', status: 'ok' });
  });
});

describe('GET /metrics', () => {
  it('exposes Prometheus metrics, outside /api/v1 and unauthenticated', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('process_cpu_seconds_total');
  });
});

describe('Unknown route', () => {
  it('returns 404 for unmatched route', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
