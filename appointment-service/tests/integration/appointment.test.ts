import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Appointment } from '../../src/models/Appointment.model';
import { Doctor } from '../../src/models/Doctor.model';
import { generateAccessToken, newUserId } from '../utils/token';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterEach(async () => {
  await Doctor.deleteMany({});
  await Appointment.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

async function createDoctor() {
  const userId = newUserId();
  const token = generateAccessToken(userId, 'doctor');
  const res = await request(app)
    .post('/api/v1/doctors/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ specialty: 'General Medicine' });

  return { userId, token, doctorId: res.body.data.doctor._id as string };
}

function futureDate(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe('POST /api/v1/appointments', () => {
  it('allows a patient to book an appointment', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.status).toBe('pending');
  });

  it('rejects a booking in the past', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctor.doctorId,
        date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it('rejects double-booking the same doctor at the same time', async () => {
    const doctor = await createDoctor();
    const date = futureDate();
    const patient1Token = generateAccessToken(newUserId(), 'patient');
    const patient2Token = generateAccessToken(newUserId(), 'patient');

    const first = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ doctorId: doctor.doctorId, date });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ doctorId: doctor.doctorId, date });

    expect(second.status).toBe(409);
  });

  it('rejects booking with a nonexistent doctor', async () => {
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: newUserId(), date: futureDate() });

    expect(res.status).toBe(404);
  });

  it('rejects doctors from booking appointments', async () => {
    const doctor = await createDoctor();
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/appointments/me', () => {
  it('lists the patient own appointments', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .get('/api/v1/appointments/me')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
  });

  it('lists the doctor own appointments', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .get('/api/v1/appointments/me')
      .set('Authorization', `Bearer ${doctor.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
  });
});

describe('PATCH /api/v1/appointments/:id/cancel', () => {
  it('allows the booking patient to cancel', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('cancelled');
  });

  it('rejects cancellation by a different patient', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const otherPatientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/cancel`)
      .set('Authorization', `Bearer ${otherPatientToken}`);

    expect(res.status).toBe(403);
  });

  it('frees up the slot for a new booking after cancellation', async () => {
    const doctor = await createDoctor();
    const date = futureDate();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date });

    await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    const otherPatientToken = generateAccessToken(newUserId(), 'patient');
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${otherPatientToken}`)
      .send({ doctorId: doctor.doctorId, date });

    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/v1/appointments/:id/confirm', () => {
  it('allows the owning doctor to confirm', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/confirm`)
      .set('Authorization', `Bearer ${doctor.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('confirmed');
  });

  it('rejects confirmation by a different doctor', async () => {
    const doctor = await createDoctor();
    const otherDoctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });

    const res = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/confirm`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a nonexistent appointment', async () => {
    const doctor = await createDoctor();
    const res = await request(app)
      .patch(`/api/v1/appointments/${newUserId()}/confirm`)
      .set('Authorization', `Bearer ${doctor.token}`);

    expect(res.status).toBe(404);
  });
});
