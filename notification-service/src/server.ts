import { createServer } from 'node:http';
import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { startEventConsumer, stopEventConsumer } from './messaging/eventConsumer';
import { startQueueLengthPoller, stopQueueLengthPoller } from './messaging/queueLengthPoller';
import { getIO, initSocketServer } from './realtime/socketServer';
import logger from './utils/logger';

async function start(): Promise<void> {
  await connectDB();
  // Not awaited: the service starts even if RabbitMQ is down and keeps retrying.
  startEventConsumer();
  startQueueLengthPoller();

  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const server = httpServer.listen(env.PORT, () => {
    logger.info(`notification-service listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  function shutdown(signal: string): void {
    logger.info(`${signal} received, shutting down gracefully`);
    getIO()?.close();
    void stopQueueLengthPoller();
    server.close(() => {
      // Drain the consumer before the database goes away so in-flight
      // messages can still be written and acked.
      void stopEventConsumer()
        .catch((err: unknown) =>
          logger.error('Error while stopping event consumer', {
            error: err instanceof Error ? err.message : err,
          }),
        )
        .then(() => disconnectDB())
        .finally(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  logger.error('Failed to start notification-service', {
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
