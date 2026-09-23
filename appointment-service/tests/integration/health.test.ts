import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/health', () => {
  it('returns service status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, service: 'appointment-service', status: 'ok' });
  });
});

describe('Unknown route', () => {
  it('returns 404 for unmatched route', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
