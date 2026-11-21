import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Appointment } from '../../src/models/Appointment.model';
import { Doctor } from '../../src/models/Doctor.model';
import { OutboxEvent } from '../../src/models/OutboxEvent.model';
import { generateAccessToken, newUserId } from '../utils/token';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterEach(async () => {
  await Doctor.deleteMany({});
  await Appointment.deleteMany({});
  await OutboxEvent.deleteMany({});
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
    .send({ name: 'Dr. Test', specialty: 'General Medicine' });

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

describe('GET /api/v1/appointments/stats', () => {
  it('summarizes status counts, doctor count and a 14-day daily trend', async () => {
    const doctor = await createDoctor();
    const patientToken = generateAccessToken(newUserId(), 'patient');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date: futureDate() });
    await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.appointment._id}/confirm`)
      .set('Authorization', `Bearer ${doctor.token}`);

    const adminToken = generateAccessToken(newUserId(), 'admin');
    const res = await request(app)
      .get('/api/v1/appointments/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalAppointments).toBe(1);
    expect(res.body.data.totalDoctors).toBe(1);
    expect(res.body.data.byStatus).toEqual({
      pending: 0,
      confirmed: 1,
      cancelled: 0,
      completed: 0,
    });
    expect(res.body.data.dailyCounts).toHaveLength(14);
    const today = new Date().toISOString().slice(0, 10);
    expect(res.body.data.dailyCounts.at(-1)).toEqual({ date: today, count: 1 });
  });

  it('is forbidden for non-admins', async () => {
    const doctor = await createDoctor();
    const res = await request(app)
      .get('/api/v1/appointments/stats')
      .set('Authorization', `Bearer ${doctor.token}`);

    expect(res.status).toBe(403);
  });
});

describe('Appointment events (transactional outbox)', () => {
  async function book() {
    const doctor = await createDoctor();
    const patientId = newUserId();
    const patientToken = generateAccessToken(patientId, 'patient');
    const date = futureDate();
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.doctorId, date });

    return {
      doctor,
      patientId,
      patientToken,
      date,
      appointmentId: res.body.data.appointment._id as string,
    };
  }

  // The request path never talks to RabbitMQ (see services/appointment.service.ts);
  // it only has to leave a correct, unpublished row behind for
  // outboxPublisher.ts to pick up later - that part is covered separately in
  // outboxPublisher.test.ts.

  it('records an unpublished appointment.created outbox row with the full payload', async () => {
    const { doctor, patientId, date, appointmentId } = await book();

    const rows = await OutboxEvent.find({ eventType: 'appointment.created' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.publishedAt).toBeFalsy();
    expect(rows[0]?.payload).toEqual({
      eventId: expect.any(String),
      eventType: 'appointment.created',
      occurredAt: expect.any(String),
      appointmentId,
      patientId,
      doctorId: doctor.doctorId,
      doctorUserId: doctor.userId,
      date,
      status: 'pending',
    });
  });

  it('records an appointment.confirmed outbox row when the doctor confirms', async () => {
    const { doctor, appointmentId } = await book();

    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/confirm`)
      .set('Authorization', `Bearer ${doctor.token}`);

    const rows = await OutboxEvent.find({ eventType: 'appointment.confirmed' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      eventType: 'appointment.confirmed',
      appointmentId,
      doctorUserId: doctor.userId,
      status: 'confirmed',
    });
  });

  it('records an appointment.cancelled outbox row when the patient cancels', async () => {
    const { doctor, patientToken, appointmentId } = await book();

    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    const rows = await OutboxEvent.find({ eventType: 'appointment.cancelled' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      eventType: 'appointment.cancelled',
      appointmentId,
      doctorUserId: doctor.userId,
      status: 'cancelled',
    });
  });

  it('does not record an outbox row when the operation fails', async () => {
    const { doctor, date } = await book();
    await OutboxEvent.deleteMany({});

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${generateAccessToken(newUserId(), 'patient')}`)
      .send({ doctorId: doctor.doctorId, date });

    expect(res.status).toBe(409);
    expect(await OutboxEvent.countDocuments()).toBe(0);
  });

  it('uses a unique eventId per event', async () => {
    const { doctor, appointmentId } = await book();
    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/confirm`)
      .set('Authorization', `Bearer ${doctor.token}`);

    const rows = await OutboxEvent.find({});
    const ids = rows.map((row) => row.payload.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
