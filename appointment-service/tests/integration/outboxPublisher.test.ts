import mongoose from 'mongoose';
import { env } from '../../src/config/env';
import { publishEvent } from '../../src/messaging/eventPublisher';
import { runOutboxTickForTests } from '../../src/messaging/outboxPublisher';
import { OutboxEvent } from '../../src/models/OutboxEvent.model';

jest.mock('../../src/messaging/eventPublisher', () => ({
  publishEvent: jest.fn(),
}));

const publishEventMock = jest.mocked(publishEvent);

function samplePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    eventType: 'appointment.created' as const,
    occurredAt: new Date().toISOString(),
    appointmentId: new mongoose.Types.ObjectId().toString(),
    patientId: new mongoose.Types.ObjectId().toString(),
    doctorId: new mongoose.Types.ObjectId().toString(),
    doctorUserId: new mongoose.Types.ObjectId().toString(),
    date: new Date().toISOString(),
    status: 'pending' as const,
    ...overrides,
  };
}

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterEach(async () => {
  await OutboxEvent.deleteMany({});
  publishEventMock.mockReset();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('outbox publisher', () => {
  it('publishes a pending row and marks it published', async () => {
    publishEventMock.mockResolvedValue(true);
    const payload = samplePayload();
    await OutboxEvent.create({ eventType: payload.eventType, payload });

    await runOutboxTickForTests();

    expect(publishEventMock).toHaveBeenCalledWith(payload);
    const row = await OutboxEvent.findOne({ 'payload.eventId': payload.eventId });
    expect(row?.publishedAt).toBeTruthy();
  });

  it('leaves the row unpublished and records the attempt when RabbitMQ is unavailable', async () => {
    publishEventMock.mockResolvedValue(false); // publishEvent's own best-effort failure signal
    const payload = samplePayload();
    await OutboxEvent.create({ eventType: payload.eventType, payload });

    await runOutboxTickForTests();

    const row = await OutboxEvent.findOne({ 'payload.eventId': payload.eventId });
    expect(row?.publishedAt).toBeFalsy();
    expect(row?.attempts).toBe(1);
  });

  it('eventually publishes a row created while RabbitMQ was down, once it recovers', async () => {
    publishEventMock.mockResolvedValue(false);
    const payload = samplePayload();
    await OutboxEvent.create({ eventType: payload.eventType, payload });

    await runOutboxTickForTests();
    let row = await OutboxEvent.findOne({ 'payload.eventId': payload.eventId });
    expect(row?.publishedAt).toBeFalsy();
    expect(row?.attempts).toBe(1);

    // RabbitMQ is back - nothing about the stored event changed, it is still
    // picked up and published, so the event is never lost.
    publishEventMock.mockResolvedValue(true);
    await runOutboxTickForTests();

    row = await OutboxEvent.findOne({ 'payload.eventId': payload.eventId });
    expect(row?.publishedAt).toBeTruthy();
  });

  it('never re-publishes a row that is already marked published', async () => {
    publishEventMock.mockResolvedValue(true);
    const payload = samplePayload();
    await OutboxEvent.create({ eventType: payload.eventType, payload, publishedAt: new Date() });

    await runOutboxTickForTests();

    expect(publishEventMock).not.toHaveBeenCalled();
  });

  it('stops a batch at the first failure instead of burning through every row', async () => {
    publishEventMock.mockResolvedValue(false);
    const first = samplePayload();
    const second = samplePayload();
    await OutboxEvent.create({ eventType: first.eventType, payload: first });
    await OutboxEvent.create({ eventType: second.eventType, payload: second });

    await runOutboxTickForTests();

    expect(publishEventMock).toHaveBeenCalledTimes(1);
  });
});
