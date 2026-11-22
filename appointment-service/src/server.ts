import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { startReminderJob, stopReminderJob } from './jobs/reminderJob';
import { startEventPublisher, stopEventPublisher } from './messaging/eventPublisher';
import { startOutboxPublisher, stopOutboxPublisher } from './messaging/outboxPublisher';
import logger from './utils/logger';

async function start(): Promise<void> {
  await connectDB();
  // Not awaited: the service starts even if RabbitMQ is down and keeps retrying.
  startEventPublisher();
  // Drains the transactional outbox (see models/OutboxEvent.model.ts); also
  // tolerant of RabbitMQ being down, since publishEvent() itself is.
  startOutboxPublisher();
  // 24h-ahead appointment reminders (see jobs/reminderJob.ts); writes to the
  // same outbox, so it inherits the same at-least-once delivery guarantee.
  startReminderJob();

  const server = app.listen(env.PORT, () => {
    logger.info(`appointment-service listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  function shutdown(signal: string): void {
    logger.info(`${signal} received, shutting down gracefully`);
    stopReminderJob();
    stopOutboxPublisher();
    server.close(() => {
      void Promise.allSettled([stopEventPublisher(), disconnectDB()]).finally(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  logger.error('Failed to start appointment-service', {
    error: err instanceof Error ? err.message : err,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
