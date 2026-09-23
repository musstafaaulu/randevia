import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Availability } from '../../src/models/Availability.model';
import { Doctor } from '../../src/models/Doctor.model';
import { generateAccessToken, newUserId } from '../utils/token';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterEach(async () => {
  await Doctor.deleteMany({});
  await Availability.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('GET /api/v1/doctors', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/doctors');
    expect(res.status).toBe(401);
  });

  it('lists doctor profiles', async () => {
    const doctorUserId = newUserId();
    const doctorToken = generateAccessToken(doctorUserId, 'doctor');
    await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ specialty: 'Cardiology', bio: 'Heart specialist' });

    const patientToken = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toHaveLength(1);
    expect(res.body.data.doctors[0].specialty).toBe('Cardiology');
  });
});

describe('POST /api/v1/doctors/me', () => {
  it('creates a doctor profile', async () => {
    const token = generateAccessToken(newUserId(), 'doctor');
    const res = await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'Dermatology' });

    expect(res.status).toBe(200);
    expect(res.body.data.doctor.specialty).toBe('Dermatology');
  });

  it('rejects patients from creating a doctor profile', async () => {
    const token = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'Dermatology' });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid specialty', async () => {
    const token = generateAccessToken(newUserId(), 'doctor');
    const res = await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'A' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/doctors/:id', () => {
  it('returns doctor detail with upcoming availability', async () => {
    const doctorUserId = newUserId();
    const doctorToken = generateAccessToken(doctorUserId, 'doctor');
    const createRes = await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ specialty: 'Neurology' });
    const doctorId = createRes.body.data.doctor._id as string;

    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ startTime: start.toISOString(), endTime: end.toISOString() });

    const patientToken = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .get(`/api/v1/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.doctor.specialty).toBe('Neurology');
    expect(res.body.data.availability).toHaveLength(1);
  });

  it('returns 400 for a malformed id', async () => {
    const token = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .get('/api/v1/doctors/not-an-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent doctor', async () => {
    const token = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .get(`/api/v1/doctors/${newUserId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/doctors/me/availability', () => {
  it('adds an availability slot', async () => {
    const token = generateAccessToken(newUserId(), 'doctor');
    await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'ENT' });

    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const res = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: start.toISOString(), endTime: end.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.availability.doctorId).toBeDefined();
  });

  it('rejects an end time before the start time', async () => {
    const token = generateAccessToken(newUserId(), 'doctor');
    await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'ENT' });

    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() - 30 * 60 * 1000);
    const res = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: start.toISOString(), endTime: end.toISOString() });

    expect(res.status).toBe(400);
  });

  it('requires a doctor profile to exist first', async () => {
    const token = generateAccessToken(newUserId(), 'doctor');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const res = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: start.toISOString(), endTime: end.toISOString() });

    expect(res.status).toBe(404);
  });

  it('rejects patients from adding availability', async () => {
    const token = generateAccessToken(newUserId(), 'patient');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const res = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: start.toISOString(), endTime: end.toISOString() });

    expect(res.status).toBe(403);
  });
});
