import { env } from '../config/env';
import logger from '../utils/logger';
import { createMessageHandler } from './messageHandler';
import { RabbitMQConnection } from './rabbitmq';
import { assertTopology, QUEUE } from './topology';

const inFlight = new Set<Promise<void>>();
let consumerTag: string | null = null;

const connection = new RabbitMQConnection({
  url: env.RABBITMQ_URL,
  connectionName: 'notification-service:consumer',
  setup: async (channel) => {
    await assertTopology(channel);
    await channel.prefetch(env.RABBITMQ_PREFETCH);

    const handle = createMessageHandler(channel);
    const reply = await channel.consume(
      QUEUE,
      (msg) => {
        const task = handle(msg)
          .catch((err: unknown) => {
            logger.error('Unexpected error in message handler', {
              error: err instanceof Error ? err.message : err,
            });
          })
          .finally(() => inFlight.delete(task));
        inFlight.add(task);
      },
      { noAck: false },
    );
    consumerTag = reply.consumerTag;
    logger.info('Consuming appointment events', { queue: QUEUE });
  },
});

export function startEventConsumer(): void {
  connection.start();
}

// Stop taking new messages, let in-flight ones finish (and be acked), then
// close. Anything left unacked is redelivered by the broker on next start.
export async function stopEventConsumer(): Promise<void> {
  const channel = connection.getChannel();
  if (channel && consumerTag) {
    await channel.cancel(consumerTag).catch(() => undefined);
  }
  consumerTag = null;
  await Promise.allSettled([...inFlight]);
  await connection.close();
}

export function isEventConsumerConnected(): boolean {
  return connection.isConnected;
}
