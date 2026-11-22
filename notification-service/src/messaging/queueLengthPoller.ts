import { env } from '../config/env';
import { rabbitmqQueueMessages } from '../middlewares/metrics';
import logger from '../utils/logger';
import { RabbitMQConnection } from './rabbitmq';
import { DEAD_LETTER_QUEUE, QUEUE, RETRY_QUEUE } from './topology';

const POLL_INTERVAL_MS = 15_000;
const QUEUES = [QUEUE, RETRY_QUEUE, DEAD_LETTER_QUEUE];

// Its own connection, deliberately separate from eventConsumer.ts's: checkQueue
// closes the whole channel on an AMQP-level error (e.g. a queue that doesn't
// exist yet), and that must never be able to take down the actual message
// consumer - polling a metric is not worth that risk.
const connection = new RabbitMQConnection({
  url: env.RABBITMQ_URL,
  connectionName: 'notification-service:metrics',
  setup: async () => {
    /* nothing to declare - the consumer's own connection owns the topology */
  },
});

let timer: ReturnType<typeof setInterval> | undefined;

async function pollOnce(): Promise<void> {
  const channel = connection.getChannel();
  if (!channel) return; // not connected right now; next tick tries again

  for (const queue of QUEUES) {
    try {
      const { messageCount } = await channel.checkQueue(queue);
      rabbitmqQueueMessages.set({ queue }, messageCount);
    } catch (err) {
      logger.warn('Could not read queue depth', {
        queue,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

export function startQueueLengthPoller(): void {
  if (timer) return;
  connection.start();
  timer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
  void pollOnce();
}

// Exposed for tests: runs exactly one poll pass instead of waiting for the
// interval timer, so tests don't need real wall-clock delays.
export const pollQueueLengthsForTests = pollOnce;

export async function stopQueueLengthPoller(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = undefined;
  await connection.close();
}
