import amqp, { Channel, ChannelModel } from 'amqplib';
import mongoose from 'mongoose';
import { env } from '../../src/config/env';
import { RETRY_COUNT_HEADER } from '../../src/messaging/messageHandler';
import {
  isEventConsumerConnected,
  startEventConsumer,
  stopEventConsumer,
} from '../../src/messaging/eventConsumer';
import {
  DEAD_LETTER_EXCHANGE,
  DEAD_LETTER_QUEUE,
  QUEUE,
  RETRY_QUEUE,
} from '../../src/messaging/topology';
import { Notification } from '../../src/models/Notification.model';
import * as notificationService from '../../src/services/notification.service';
import { makeEvent } from '../utils/events';

// Runs against the real RabbitMQ from docker-compose, on a test-only exchange
// and queue set (see tests/setupEnv.ts).
jest.setTimeout(20_000);

let publisherModel: ChannelModel;
let publisher: Channel;

async function waitFor<T>(check: () => Promise<T | undefined | false>, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function deleteTopology(channel: Channel): Promise<void> {
  for (const queue of [QUEUE, RETRY_QUEUE, DEAD_LETTER_QUEUE]) await channel.deleteQueue(queue);
  await channel.deleteExchange(DEAD_LETTER_EXCHANGE);
  await channel.deleteExchange(env.RABBITMQ_EXCHANGE);
}

function publish(routingKey: string, body: unknown): void {
  const content = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  publisher.publish(env.RABBITMQ_EXCHANGE, routingKey, content, { persistent: true });
}

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
  await Notification.syncIndexes();

  publisherModel = await amqp.connect(env.RABBITMQ_URL);
  publisher = await publisherModel.createChannel();
  await deleteTopology(publisher);

  startEventConsumer();
  await waitFor(async () => isEventConsumerConnected());
});

afterEach(async () => {
  jest.restoreAllMocks();
  await publisher.purgeQueue(DEAD_LETTER_QUEUE);
  await Notification.deleteMany({});
});

afterAll(async () => {
  await stopEventConsumer();
  await deleteTopology(publisher);
  await publisherModel.close();
  await mongoose.disconnect();
});

describe('appointment event consumer (RabbitMQ)', () => {
  it('turns a published event into patient and doctor notifications', async () => {
    const event = makeEvent();

    publish(event.eventType, event);

    const notifications = await waitFor(async () => {
      const found = await Notification.find({ eventId: event.eventId, status: 'sent' });
      return found.length === 2 && found;
    });
    expect(notifications.map((n) => n.recipientRole).sort()).toEqual(['doctor', 'patient']);
  });

  it.each(['appointment.confirmed', 'appointment.cancelled'] as const)(
    'consumes %s events',
    async (eventType) => {
      const event = makeEvent({ eventType });

      publish(eventType, event);

      await waitFor(
        async () => (await Notification.countDocuments({ eventId: event.eventId })) === 2,
      );
    },
  );

  it('moves a malformed message to the dead-letter queue and keeps consuming', async () => {
    publish('appointment.created', '{this is not json');
    const next = makeEvent();
    publish(next.eventType, next);

    const dead = await waitFor(async () => publisher.get(DEAD_LETTER_QUEUE, { noAck: true }));
    expect(dead.content.toString()).toBe('{this is not json');
    await waitFor(async () => (await Notification.countDocuments({ eventId: next.eventId })) === 2);
  });

  it('retries a transient failure via the delay queue and then succeeds', async () => {
    const spy = jest
      .spyOn(notificationService, 'processAppointmentEvent')
      .mockRejectedValueOnce(new Error('db hiccup'));
    const event = makeEvent();

    publish(event.eventType, event);

    await waitFor(
      async () => (await Notification.countDocuments({ eventId: event.eventId })) === 2,
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('dead-letters an event after exhausting retries instead of looping', async () => {
    const spy = jest
      .spyOn(notificationService, 'processAppointmentEvent')
      .mockRejectedValue(new Error('permanently broken'));
    const event = makeEvent();

    publish(event.eventType, event);

    const dead = await waitFor(async () => publisher.get(DEAD_LETTER_QUEUE, { noAck: true }));
    expect(JSON.parse(dead.content.toString()).eventId).toBe(event.eventId);
    expect(dead.properties.headers?.[RETRY_COUNT_HEADER]).toBe(env.MESSAGE_MAX_RETRIES);
    // First attempt + MESSAGE_MAX_RETRIES retries, then it stops.
    expect(spy).toHaveBeenCalledTimes(env.MESSAGE_MAX_RETRIES + 1);
  });
});
