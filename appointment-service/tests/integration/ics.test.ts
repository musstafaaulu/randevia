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
    .send({ name: 'Dr. Ics', specialty: 'Cardiology' });
  return { userId, token, doctorId: res.body.data.doctor._id as string };
}

describe('GET /api/v1/appointments/:id/ics', () => {
  it('returns a calendar file for the patient who booked it', async () => {
    const doctor = await createDoctor();
    const patientId = newUserId();
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appointment = await Appointment.create({
      patientId,
      doctorId: doctor.doctorId,
      date,
      status: 'confirmed',
    });

    const res = await request(app)
      .get(`/api/v1/appointments/${appointment._id.toString()}/ics`)
      .set('Authorization', `Bearer ${generateAccessToken(patientId, 'patient')}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('Dr. Ics');
  });

  it('returns a calendar file for the doctor it belongs to', async () => {
    const doctor = await createDoctor();
    const appointment = await Appointment.create({
      patientId: newUserId(),
      doctorId: doctor.doctorId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'confirmed',
    });

    const res = await request(app)
      .get(`/api/v1/appointments/${appointment._id.toString()}/ics`)
      .set('Authorization', `Bearer ${doctor.token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('BEGIN:VCALENDAR');
  });

  it('forbids a patient who is not the owner', async () => {
    const doctor = await createDoctor();
    const appointment = await Appointment.create({
      patientId: newUserId(),
      doctorId: doctor.doctorId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'confirmed',
    });

    const res = await request(app)
      .get(`/api/v1/appointments/${appointment._id.toString()}/ics`)
      .set('Authorization', `Bearer ${generateAccessToken(newUserId(), 'patient')}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an appointment that does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${new mongoose.Types.ObjectId().toString()}/ics`)
      .set('Authorization', `Bearer ${generateAccessToken(newUserId(), 'patient')}`);

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(
      `/api/v1/appointments/${new mongoose.Types.ObjectId().toString()}/ics`,
    );
    expect(res.status).toBe(401);
  });
});
