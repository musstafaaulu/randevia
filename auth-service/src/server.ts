import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import logger from './utils/logger';

async function start(): Promise<void> {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`auth-service listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  function shutdown(signal: string): void {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      void disconnectDB().finally(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  logger.error('Failed to start auth-service', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
