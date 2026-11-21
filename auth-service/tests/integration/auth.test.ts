import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { RefreshToken } from '../../src/models/RefreshToken.model';
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
  await RefreshToken.deleteMany({});
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
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
  });
});

describe('Refresh token rotation', () => {
  it('invalidates the old refresh token once it has been used', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const refreshToken = extractCookie(registerRes).split('=')[1];

    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('issues a new refresh token different from the old one each time', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const firstToken = extractCookie(registerRes).split('=')[1];

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstToken });
    const secondToken = extractCookie(res).split('=')[1];

    expect(secondToken).toBeDefined();
    expect(secondToken).not.toBe(firstToken);
  });

  it('revokes every refresh token for the user when a rotated-away token is reused', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const originalToken = extractCookie(registerRes).split('=')[1];

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalToken });
    expect(rotated.status).toBe(200);
    const rotatedToken = extractCookie(rotated).split('=')[1];

    // Replaying the already-rotated token is exactly what a stolen token
    // being used after the legitimate client already moved on looks like.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalToken });
    expect(replay.status).toBe(401);

    // The whole user is logged out, not just this one chain: even the
    // legitimately-rotated token from a moment ago is now dead too.
    const afterTheft = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedToken });
    expect(afterTheft.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the refresh token so it can no longer be used to refresh', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const refreshToken = extractCookie(registerRes).split('=')[1];

    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('clears the refresh cookie', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const refreshToken = extractCookie(registerRes).split('=')[1];

    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    const setCookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(setCookie).toMatch(/refreshToken=;?/);
    expect(setCookie.toLowerCase()).toMatch(/expires=|max-age=0/);
  });

  it('succeeds even with no refresh token at all (idempotent)', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(baseUser.email);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/auth/me', () => {
  it('updates the authenticated user name', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Ada Byron' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Ada Byron');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.body.data.user.name).toBe('Ada Byron');
  });

  it('rejects a name shorter than 2 characters', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'A' });

    expect(res.status).toBe(400);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).patch('/api/v1/auth/me').send({ name: 'Nobody' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/auth/me/password', () => {
  it('changes the password when the current password is correct', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: baseUser.password, newPassword: 'brand-new-password' });

    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: baseUser.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: 'brand-new-password' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'totally-wrong', newPassword: 'brand-new-password' });

    expect(res.status).toBe(401);

    const stillOldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: baseUser.password });
    expect(stillOldLogin.status).toBe(200);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(baseUser);
    const { accessToken } = registerRes.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: baseUser.password, newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .send({ currentPassword: baseUser.password, newPassword: 'brand-new-password' });
    expect(res.status).toBe(401);
  });
});
