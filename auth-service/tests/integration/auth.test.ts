import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { User } from '../../src/models/User.model';

function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const raw = setCookie?.[0];
  if (!raw) throw new Error('Expected a Set-Cookie header in the response');
  return raw.split(';')[0] as string;
}

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

const baseUser = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'supersecret123',
};

describe('POST /api/v1/auth/register', () => {
  it('registers a new user as a patient by default', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(baseUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(baseUser.email);
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();
    expect(extractCookie(res)).toContain('refreshToken=');
  });

  it('rejects self-registration as a doctor', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...baseUser, email: 'doc@example.com', role: 'doctor' });

    expect(res.status).toBe(400);
    expect(await User.countDocuments({ email: 'doc@example.com' })).toBe(0);
  });

  it('rejects self-registration as admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...baseUser, email: 'admin@example.com', role: 'admin' });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(baseUser);
    const res = await request(app).post('/api/v1/auth/register').send(baseUser);

    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...baseUser, password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(baseUser);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: baseUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(extractCookie(res)).toContain('refreshToken=');
  });

  it('rejects an invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: baseUser.password });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('issues a new access token from a valid refresh cookie', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const cookie = extractCookie(registerRes);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({});

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('accepts a refresh token from the request body as a fallback', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const refreshToken = extractCookie(registerRes).split('=')[1];

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects when no refresh token is present', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(401);
  });

  it('rejects an invalid refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(baseUser.email);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
