import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { RefreshToken } from '../../src/models/RefreshToken.model';
import { User } from '../../src/models/User.model';
import { VerificationToken } from '../../src/models/VerificationToken.model';
import * as mailer from '../../src/utils/mailer';

function linkFrom(html: string): string {
  const match = /href="([^"]+)"/.exec(html);
  if (!match?.[1]) throw new Error('No link found in mail body');
  return match[1];
}

function tokenFrom(html: string): string {
  const url = new URL(linkFrom(html));
  const token = url.searchParams.get('token');
  if (!token) throw new Error('No token in link');
  return token;
}

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

beforeEach(() => {
  jest.spyOn(mailer, 'sendMail').mockResolvedValue(undefined);
});

afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await VerificationToken.deleteMany({});
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
});

const baseUser = { name: 'Grace Hopper', email: 'grace@example.com', password: 'supersecret123' };

describe('Email verification', () => {
  it('sends a verification e-mail on register and creates the user as unverified', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(baseUser);

    expect(res.status).toBe(201);
    expect(res.body.data.user.emailVerified).toBe(false);
    // Fire-and-forget: give the unawaited send a tick to run.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: baseUser.email }),
    );
  });

  it('verifies the e-mail with the token from the mail and rejects reusing it', async () => {
    await request(app).post('/api/v1/auth/register').send(baseUser);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const html = (mailer.sendMail as jest.Mock).mock.calls[0][0].html as string;
    const token = tokenFrom(html);

    const first = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(first.status).toBe(200);
    expect((await User.findOne({ email: baseUser.email }))?.emailVerified).toBe(true);

    const second = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: 'nope' });
    expect(res.status).toBe(400);
  });

  it('resends the verification e-mail for an authenticated, unverified user', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const accessToken = register.body.data.accessToken as string;
    await new Promise((resolve) => setTimeout(resolve, 10)); // let register's fire-and-forget send land first
    (mailer.sendMail as jest.Mock).mockClear();

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  it('refuses to resend once the e-mail is already verified', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const accessToken = register.body.data.accessToken as string;
    await User.updateOne({ email: baseUser.email }, { emailVerified: true });

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('requires authentication to resend', async () => {
    const res = await request(app).post('/api/v1/auth/resend-verification');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('sends a reset e-mail for a known address', async () => {
    await request(app).post('/api/v1/auth/register').send(baseUser);
    await new Promise((resolve) => setTimeout(resolve, 10)); // let register's fire-and-forget send land first
    (mailer.sendMail as jest.Mock).mockClear();

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: baseUser.email });

    expect(res.status).toBe(200);
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: baseUser.email, subject: expect.stringContaining('sıfırlama') }),
    );
  });

  it('responds the same way for an unknown address, without sending mail', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('resets the password, revokes every session, and the old password stops working', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const user = await User.findOne({ email: baseUser.email });
    await request(app).post('/api/v1/auth/login').send(baseUser); // a second, independent session
    await new Promise((resolve) => setTimeout(resolve, 10)); // let register's fire-and-forget send land first

    (mailer.sendMail as jest.Mock).mockClear();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: baseUser.email });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const html = (mailer.sendMail as jest.Mock).mock.calls[0][0].html as string;
    const token = tokenFrom(html);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'brand-new-password-123' });
    expect(res.status).toBe(200);

    const loginOld = await request(app).post('/api/v1/auth/login').send(baseUser);
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: baseUser.email, password: 'brand-new-password-123' });
    expect(loginNew.status).toBe(200);

    expect(await RefreshToken.countDocuments({ userId: user!._id, revokedAt: null })).toBe(1); // only the fresh login above
    const refreshCookie = register.headers['set-cookie'] as unknown as string[];
    const refreshToken = refreshCookie[0]!.split(';')[0]!.split('=')[1];
    const staleRefresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(staleRefresh.status).toBe(401);
  });

  it('rejects an invalid or expired token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'nope', newPassword: 'brand-new-password-123' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/internal/users/:id', () => {
  it('returns the user for a request carrying the shared internal token', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const userId = register.body.data.user._id as string;

    const res = await request(app)
      .get(`/api/v1/auth/internal/users/${userId}`)
      .set('x-internal-service-token', env.INTERNAL_SERVICE_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      role: 'patient',
    });
  });

  it('rejects a request without the shared internal token', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const userId = register.body.data.user._id as string;

    const res = await request(app).get(`/api/v1/auth/internal/users/${userId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong internal token', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(baseUser);
    const userId = register.body.data.user._id as string;

    const res = await request(app)
      .get(`/api/v1/auth/internal/users/${userId}`)
      .set('x-internal-service-token', 'wrong-token');

    expect(res.status).toBe(401);
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/auth/internal/users/${new mongoose.Types.ObjectId().toString()}`)
      .set('x-internal-service-token', env.INTERNAL_SERVICE_TOKEN);

    expect(res.status).toBe(404);
  });
});
