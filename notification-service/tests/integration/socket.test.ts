import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { type Socket as ClientSocket, io as ioClient } from 'socket.io-client';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Notification } from '../../src/models/Notification.model';
import { getIO, initSocketServer } from '../../src/realtime/socketServer';
import { processAppointmentEvent } from '../../src/services/notification.service';
import * as sender from '../../src/services/notificationSender';
import { makeEvent } from '../utils/events';
import { generateAccessToken, newUserId } from '../utils/token';

let httpServer: HttpServer;
let baseUrl: string;
const clients: ClientSocket[] = [];

function connectClient(token?: string): ClientSocket {
  const client = ioClient(baseUrl, {
    path: '/socket.io',
    auth: token ? { token } : {},
    reconnection: false,
    forceNew: true,
  });
  clients.push(client);
  return client;
}

function waitForEvent<T>(client: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForConnect(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', (err: Error) => reject(err));
  });
}

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
  await Notification.syncIndexes();

  httpServer = createServer(app);
  initSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

beforeEach(() => {
  // This file is about the realtime socket layer, not e-mail delivery - see
  // notification.test.ts for that.
  jest.spyOn(sender, 'sendNotification').mockResolvedValue(undefined);
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Notification.deleteMany({});
  jest.restoreAllMocks();
});

afterAll(async () => {
  getIO()?.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
});

describe('Socket.io authentication', () => {
  it('rejects a connection without a token', async () => {
    const client = connectClient();
    await expect(waitForConnect(client)).rejects.toThrow();
  });

  it('rejects a connection with an invalid token', async () => {
    const client = connectClient('not-a-valid-token');
    await expect(waitForConnect(client)).rejects.toThrow();
  });

  it('accepts a connection with a valid token', async () => {
    const client = connectClient(generateAccessToken(newUserId(), 'patient'));
    await expect(waitForConnect(client)).resolves.toBeUndefined();
  });
});

describe('Socket.io notification delivery', () => {
  it('sends a notification event to the patient in their own room, with the unread count', async () => {
    const patientId = newUserId();
    const client = connectClient(generateAccessToken(patientId, 'patient'));
    await waitForConnect(client);

    const received = waitForEvent<{ notification: { recipientId: string }; unreadCount: number }>(
      client,
      'notification',
    );
    await processAppointmentEvent(makeEvent({ patientId }));

    const payload = await received;
    expect(payload.notification.recipientId).toBe(patientId);
    expect(payload.unreadCount).toBe(1);
  });

  it('sends a notification event to the doctor in their own room', async () => {
    const doctorUserId = newUserId();
    const client = connectClient(generateAccessToken(doctorUserId, 'doctor'));
    await waitForConnect(client);

    const received = waitForEvent<{ notification: { recipientId: string } }>(
      client,
      'notification',
    );
    await processAppointmentEvent(makeEvent({ doctorUserId }));

    const payload = await received;
    expect(payload.notification.recipientId).toBe(doctorUserId);
  });

  it('never sends a notification meant for someone else', async () => {
    const client = connectClient(generateAccessToken(newUserId(), 'patient'));
    await waitForConnect(client);

    const sawUnexpectedEvent = waitForEvent(client, 'notification', 300).then(
      () => true,
      () => false,
    );
    await processAppointmentEvent(makeEvent());

    expect(await sawUnexpectedEvent).toBe(false);
  });
});

describe('Socket.io doctor room (slot.updated)', () => {
  function watch(client: ClientSocket, doctorId: string): Promise<void> {
    return new Promise((resolve) => client.emit('doctor:watch', doctorId, resolve));
  }

  it('broadcasts slot.updated to everyone watching that doctor', async () => {
    const doctorId = newUserId();
    const client = connectClient(generateAccessToken(newUserId(), 'patient'));
    await waitForConnect(client);
    await watch(client, doctorId);

    const received = waitForEvent<{ doctorId: string; eventType: string }>(client, 'slot.updated');
    const event = makeEvent({ doctorId, eventType: 'appointment.created' });
    await processAppointmentEvent(event);

    const payload = await received;
    expect(payload.doctorId).toBe(doctorId);
    expect(payload.eventType).toBe('appointment.created');
  });

  it('does not broadcast to a client that has not watched that doctor', async () => {
    const client = connectClient(generateAccessToken(newUserId(), 'patient'));
    await waitForConnect(client);

    const sawUnexpectedEvent = waitForEvent(client, 'slot.updated', 300).then(
      () => true,
      () => false,
    );
    await processAppointmentEvent(makeEvent());

    expect(await sawUnexpectedEvent).toBe(false);
  });
});
