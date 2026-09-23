import type { Channel } from 'amqplib';
import { env } from '../config/env';
import { APPOINTMENT_EVENT_TYPES } from '../events/appointment.events';

export const QUEUE = env.NOTIFICATION_QUEUE;
export const RETRY_QUEUE = `${QUEUE}.retry`;
export const DEAD_LETTER_EXCHANGE = `${QUEUE}.dlx`;
export const DEAD_LETTER_QUEUE = `${QUEUE}.dlq`;

// randevia.events (topic) --appointment.*--> QUEUE --nack(requeue=false)--> DLX --> DLQ
//                                              ^                    |
//                                              +-- RETRY_QUEUE <----+ (transient failure,
//                                                  (per-message TTL,   republished with
//                                                   dead-letters back)  x-retry-count + 1)
export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });

  await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE);

  await channel.assertQueue(QUEUE, {
    durable: true,
    deadLetterExchange: DEAD_LETTER_EXCHANGE,
    deadLetterRoutingKey: DEAD_LETTER_QUEUE,
  });
  for (const eventType of APPOINTMENT_EVENT_TYPES) {
    await channel.bindQueue(QUEUE, env.RABBITMQ_EXCHANGE, eventType);
  }

  // No queue-level TTL: the delay is set per message, so changing
  // MESSAGE_RETRY_DELAY_MS never conflicts with an already-declared queue.
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: QUEUE,
  });
}
