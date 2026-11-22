import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { runReminderTickForTests } from '../../src/jobs/reminderJob';
import { Appointment } from '../../src/models/Appointment.model';
import { Doctor } from '../../src/models/Doctor.model';
import { OutboxEvent } from '../../src/models/OutboxEvent.model';
import { generateAccessToken, newUserId } from '../utils/token';

const HOUR_MS = 60 * 60 * 1000;
const LEAD_TIME_MS = 24 * HOUR_MS;

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
    .send({ name: 'Dr. Reminder', specialty: 'General Medicine' });
  return { userId, doctorId: res.body.data.doctor._id as string };
}

async function createAppointment(
  doctorId: string,
  overrides: { status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'; hoursFromNow?: number } = {},
) {
  const patientId = newUserId();
  const date = new Date(Date.now() + (overrides.hoursFromNow ?? 12) * HOUR_MS);
  return Appointment.create({
    patientId,
    doctorId,
    date,
    status: overrides.status ?? 'confirmed',
  });
}

describe('reminder job', () => {
  it('queues a reminder for a confirmed appointment within the lead time', async () => {
    const doctor = await createDoctor();
    const appointment = await createAppointment(doctor.doctorId, { hoursFromNow: 12 });

    await runReminderTickForTests();

    const refreshed = await Appointment.findById(appointment._id);
    expect(refreshed?.reminderSentAt).toBeTruthy();
    const outboxRow = await OutboxEvent.findOne({ 'payload.appointmentId': appointment._id.toString() });
    expect(outboxRow?.payload).toMatchObject({ eventType: 'appointment.reminder' });
  });

  it('never reminds the same appointment twice', async () => {
    const doctor = await createDoctor();
    const appointment = await createAppointment(doctor.doctorId, { hoursFromNow: 12 });

    await runReminderTickForTests();
    await runReminderTickForTests();

    const count = await OutboxEvent.countDocuments({
      'payload.appointmentId': appointment._id.toString(),
    });
    expect(count).toBe(1);
  });

  it('ignores an appointment further away than the lead time', async () => {
    const doctor = await createDoctor();
    const appointment = await createAppointment(doctor.doctorId, { hoursFromNow: 48 });

    await runReminderTickForTests();

    const refreshed = await Appointment.findById(appointment._id);
    expect(refreshed?.reminderSentAt).toBeFalsy();
  });

  it('ignores a pending (not yet confirmed) appointment', async () => {
    const doctor = await createDoctor();
    const appointment = await createAppointment(doctor.doctorId, {
      status: 'pending',
      hoursFromNow: 12,
    });

    await runReminderTickForTests();

    const refreshed = await Appointment.findById(appointment._id);
    expect(refreshed?.reminderSentAt).toBeFalsy();
  });

  it('ignores a cancelled appointment', async () => {
    const doctor = await createDoctor();
    const appointment = await createAppointment(doctor.doctorId, {
      status: 'cancelled',
      hoursFromNow: 12,
    });

    await runReminderTickForTests();

    const refreshed = await Appointment.findById(appointment._id);
    expect(refreshed?.reminderSentAt).toBeFalsy();
  });

  it('ignores an appointment that has already passed', async () => {
    const doctor = await createDoctor();
    const appointment = await Appointment.create({
      patientId: newUserId(),
      doctorId: doctor.doctorId,
      date: new Date(Date.now() - HOUR_MS),
      status: 'confirmed',
    });

    await runReminderTickForTests();

    const refreshed = await Appointment.findById(appointment._id);
    expect(refreshed?.reminderSentAt).toBeFalsy();
  });
});

// Sanity check that the job's own default (env.REMINDER_LEAD_TIME_MS) matches
// what the rest of this file assumes.
it('defaults to a 24h lead time', () => {
  expect(env.REMINDER_LEAD_TIME_MS).toBe(LEAD_TIME_MS);
});
