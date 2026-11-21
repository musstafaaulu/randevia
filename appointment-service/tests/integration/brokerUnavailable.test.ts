import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Appointment } from '../../src/models/Appointment.model';
import { Doctor } from '../../src/models/Doctor.model';
import { OutboxEvent } from '../../src/models/OutboxEvent.model';
import { generateAccessToken, newUserId } from '../utils/token';

// The real publisher is used here but never started, which is exactly the
// state of the service while RabbitMQ is unreachable.
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

describe('Appointment operations while RabbitMQ is unavailable', () => {
  it('still books, confirms and cancels appointments', async () => {
    const doctorToken = generateAccessToken(newUserId(), 'doctor');
    const doctorRes = await request(app)
      .post('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ name: 'Dr. Test', specialty: 'Cardiology' });
    const patientToken = generateAccessToken(newUserId(), 'patient');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorRes.body.data.doctor._id,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data.appointment._id as string;

    const confirmRes = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/confirm`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(confirmRes.status).toBe(200);

    const cancelRes = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(cancelRes.status).toBe(200);

    // Nothing in this process has ever connected to RabbitMQ (no publisher
    // started, no outbox tick run), yet all three writes above left their
    // event safely recorded - this is the whole point of the outbox: an
    // event isn't "lost" just because nobody has published it yet.
    const rows = await OutboxEvent.find({}).sort({ createdAt: 1 });
    expect(rows.map((row) => row.eventType)).toEqual([
      'appointment.created',
      'appointment.confirmed',
      'appointment.cancelled',
    ]);
    expect(rows.every((row) => !row.publishedAt)).toBe(true);
  });

  it('reports rabbitmq as disconnected in the health check', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.body.dependencies).toEqual({ rabbitmq: 'disconnected' });
  });
});
