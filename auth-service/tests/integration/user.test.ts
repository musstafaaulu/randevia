import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { generateOpaqueToken, hashToken, RefreshToken } from '../../src/models/RefreshToken.model';
import { IUser, User } from '../../src/models/User.model';
import { generateAccessToken } from '../../src/services/token.service';
import { ensureAdminUser } from '../../src/services/user.service';
import type { Role } from '../../src/types/role';

let counter = 0;

async function createUser(role: Role): Promise<IUser> {
  counter += 1;
  return User.create({
    name: `User ${counter}`,
    email: `user${counter}@example.com`,
    password: 'supersecret123',
    role,
  });
}

function bearer(user: IUser): string {
  return `Bearer ${generateAccessToken(user._id.toString(), user.role)}`;
}

// Mirrors what auth.service.ts's issueTokens() does, without going through a
// real register/login call - this file creates users directly via the model.
async function issueRefreshToken(user: IUser): Promise<string> {
  const token = generateOpaqueToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    family: randomUUID(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
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

describe('PATCH /api/v1/auth/users/:id/role', () => {
  it('lets an admin promote a patient to doctor', async () => {
    const admin = await createUser('admin');
    const patient = await createUser('patient');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${patient._id.toString()}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'doctor' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('doctor');
    expect((await User.findById(patient._id))?.role).toBe('doctor');
  });

  it('issues the new role on the next token refresh', async () => {
    const admin = await createUser('admin');
    const patient = await createUser('patient');
    const refreshToken = await issueRefreshToken(patient);

    await request(app)
      .patch(`/api/v1/auth/users/${patient._id.toString()}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'doctor' });
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('doctor');
  });

  it.each(['patient', 'doctor'] as const)('forbids a %s from assigning roles', async (role) => {
    const actor = await createUser(role);
    const target = await createUser('patient');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${target._id.toString()}/role`)
      .set('Authorization', bearer(actor))
      .send({ role: 'doctor' });

    expect(res.status).toBe(403);
    expect((await User.findById(target._id))?.role).toBe('patient');
  });

  it('requires authentication', async () => {
    const target = await createUser('patient');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${target._id.toString()}/role`)
      .send({ role: 'doctor' });

    expect(res.status).toBe(401);
  });

  it('prevents an admin from changing their own role', async () => {
    const admin = await createUser('admin');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${admin._id.toString()}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'patient' });

    expect(res.status).toBe(400);
    expect((await User.findById(admin._id))?.role).toBe('admin');
  });

  it('rejects an unknown role', async () => {
    const admin = await createUser('admin');
    const target = await createUser('patient');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${target._id.toString()}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid user id', async () => {
    const admin = await createUser('admin');

    const res = await request(app)
      .patch('/api/v1/auth/users/not-an-id/role')
      .set('Authorization', bearer(admin))
      .send({ role: 'doctor' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a user that does not exist', async () => {
    const admin = await createUser('admin');

    const res = await request(app)
      .patch(`/api/v1/auth/users/${new mongoose.Types.ObjectId().toString()}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'doctor' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/auth/users', () => {
  it('lists users for an admin, filtered by role from the query string', async () => {
    const admin = await createUser('admin');
    await createUser('patient');
    const doctor = await createUser('doctor');

    const res = await request(app)
      .get('/api/v1/auth/users?role=doctor&limit=5')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0]._id).toBe(doctor._id.toString());
    expect(res.body.data.users[0].password).toBeUndefined();
    // Coerced by the query schema, so it arrives as a number, not "5".
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });
  });

  it('rejects an invalid query', async () => {
    const admin = await createUser('admin');

    const res = await request(app)
      .get('/api/v1/auth/users?limit=1000')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
  });

  it('is forbidden for non-admins', async () => {
    const patient = await createUser('patient');

    const res = await request(app).get('/api/v1/auth/users').set('Authorization', bearer(patient));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/users/stats', () => {
  it('counts users by role for an admin', async () => {
    const admin = await createUser('admin');
    await createUser('patient');
    await createUser('patient');
    await createUser('doctor');

    const res = await request(app)
      .get('/api/v1/auth/users/stats')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 4,
      byRole: { patient: 2, doctor: 1, admin: 1 },
    });
  });

  it('is forbidden for non-admins', async () => {
    const patient = await createUser('patient');

    const res = await request(app)
      .get('/api/v1/auth/users/stats')
      .set('Authorization', bearer(patient));

    expect(res.status).toBe(403);
  });
});

describe('ensureAdminUser', () => {
  const original = { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD };

  afterEach(() => {
    env.ADMIN_EMAIL = original.email;
    env.ADMIN_PASSWORD = original.password;
  });

  it('does nothing when no admin credentials are configured', async () => {
    env.ADMIN_EMAIL = undefined;
    env.ADMIN_PASSWORD = undefined;

    await ensureAdminUser();

    expect(await User.countDocuments({})).toBe(0);
  });

  it('creates the configured admin once and lets it log in', async () => {
    env.ADMIN_EMAIL = 'root@example.com';
    env.ADMIN_PASSWORD = 'root-password-123';

    await ensureAdminUser();
    await ensureAdminUser();

    expect(await User.countDocuments({ email: 'root@example.com', role: 'admin' })).toBe(1);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'root@example.com', password: 'root-password-123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('promotes an existing account with the admin email', async () => {
    const existing = await createUser('patient');
    env.ADMIN_EMAIL = existing.email;
    env.ADMIN_PASSWORD = 'root-password-123';

    await ensureAdminUser();

    expect((await User.findById(existing._id))?.role).toBe('admin');
  });

  it('rotates the admin password when ADMIN_PASSWORD changes', async () => {
    env.ADMIN_EMAIL = 'root@example.com';
    env.ADMIN_PASSWORD = 'old-password-123';
    await ensureAdminUser();

    env.ADMIN_PASSWORD = 'new-password-456';
    await ensureAdminUser();

    const login = (password: string) =>
      request(app).post('/api/v1/auth/login').send({ email: 'root@example.com', password });
    expect((await login('old-password-123')).status).toBe(401);
    expect((await login('new-password-456')).status).toBe(200);
  });

  it('leaves the password hash alone when it already matches', async () => {
    env.ADMIN_EMAIL = 'root@example.com';
    env.ADMIN_PASSWORD = 'root-password-123';
    await ensureAdminUser();
    const before = await User.findOne({ email: 'root@example.com' }).select('+password');

    await ensureAdminUser();

    const after = await User.findOne({ email: 'root@example.com' }).select('+password');
    expect(after?.password).toBe(before?.password);
  });
});
