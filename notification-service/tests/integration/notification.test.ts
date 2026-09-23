import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Notification } from '../../src/models/Notification.model';
import * as sender from '../../src/services/notificationSender';
import { processAppointmentEvent } from '../../src/services/notification.service';
import { makeEvent } from '../utils/events';
import { generateAccessToken, newUserId } from '../utils/token';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
  await Notification.syncIndexes();
});

afterEach(async () => {
  await Notification.deleteMany({});
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('processAppointmentEvent', () => {
  it('stores and delivers one notification for the patient and one for the doctor', async () => {
    const sendSpy = jest.spyOn(sender, 'sendNotification');
    const event = makeEvent();

    const result = await processAppointmentEvent(event);

    expect(result.delivered).toBe(2);
    expect(sendSpy).toHaveBeenCalledTimes(2);

    const notifications = await Notification.find({ eventId: event.eventId }).lean();
    expect(notifications).toHaveLength(2);
    const byRole = Object.fromEntries(notifications.map((n) => [n.recipientRole, n]));
    expect(byRole.patient?.recipientId.toString()).toBe(event.patientId);
    expect(byRole.doctor?.recipientId.toString()).toBe(event.doctorUserId);
    for (const n of notifications) {
      expect(n).toMatchObject({ status: 'sent', channel: 'email', type: event.eventType });
      expect(n.sentAt).toBeInstanceOf(Date);
      expect(n.appointmentId.toString()).toBe(event.appointmentId);
      expect(n.appointmentDate.toISOString()).toBe(event.date);
    }
  });

  it('is idempotent when the same event is delivered twice', async () => {
    const sendSpy = jest.spyOn(sender, 'sendNotification');
    const event = makeEvent();

    await processAppointmentEvent(event);
    const second = await processAppointmentEvent(event);

    expect(second.delivered).toBe(0);
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(await Notification.countDocuments({ eventId: event.eventId })).toBe(2);
  });

  it('finishes delivery on redelivery after a failure mid-way', async () => {
    const event = makeEvent();
    jest.spyOn(sender, 'sendNotification').mockRejectedValueOnce(new Error('smtp down'));

    await expect(processAppointmentEvent(event)).rejects.toThrow('smtp down');
    expect(await Notification.countDocuments({ eventId: event.eventId, status: 'pending' })).toBe(
      2,
    );

    const retry = await processAppointmentEvent(event);

    expect(retry.delivered).toBe(2);
    expect(await Notification.countDocuments({ eventId: event.eventId, status: 'sent' })).toBe(2);
  });
});

describe('GET /api/v1/notifications/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/notifications/me');

    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/me')
      .set('Authorization', 'Bearer not-a-token');

    expect(res.status).toBe(401);
  });

  it('returns only the caller own notifications, newest first', async () => {
    const patientId = newUserId();
    const first = makeEvent({ patientId });
    const second = makeEvent({
      patientId,
      appointmentId: first.appointmentId,
      eventType: 'appointment.confirmed',
    });
    await processAppointmentEvent(first);
    await processAppointmentEvent(second);
    await processAppointmentEvent(makeEvent());

    const res = await request(app)
      .get('/api/v1/notifications/me')
      .set('Authorization', `Bearer ${generateAccessToken(patientId, 'patient')}`);

    expect(res.status).toBe(200);
    const { notifications, pagination } = res.body.data;
    expect(notifications).toHaveLength(2);
    expect(notifications.map((n: { type: string }) => n.type)).toEqual([
      'appointment.confirmed',
      'appointment.created',
    ]);
    expect(notifications.every((n: { recipientId: string }) => n.recipientId === patientId)).toBe(
      true,
    );
    expect(pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('shows the doctor their notifications by user id', async () => {
    const doctorUserId = newUserId();
    await processAppointmentEvent(makeEvent({ doctorUserId }));

    const res = await request(app)
      .get('/api/v1/notifications/me')
      .set('Authorization', `Bearer ${generateAccessToken(doctorUserId, 'doctor')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.notifications[0]).toMatchObject({
      recipientRole: 'doctor',
      title: 'New appointment request',
    });
  });

  it('paginates results', async () => {
    const patientId = newUserId();
    for (let i = 0; i < 3; i += 1) {
      await processAppointmentEvent(makeEvent({ patientId }));
    }

    const res = await request(app)
      .get('/api/v1/notifications/me?page=2&limit=2')
      .set('Authorization', `Bearer ${generateAccessToken(patientId, 'patient')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('validates pagination parameters', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/me?limit=1000')
      .set('Authorization', `Bearer ${generateAccessToken(newUserId(), 'patient')}`);

    expect(res.status).toBe(400);
  });
});
