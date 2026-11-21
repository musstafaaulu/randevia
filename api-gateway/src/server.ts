import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { createApp } from './app';
import { env } from './config/env';
import { SERVICE_ROUTES, serviceUrls } from './proxy/services';
import type { UpgradeHandler } from './proxy/createWsProxy';
import logger from './utils/logger';

const app = createApp(env);
const urls = serviceUrls(env);

const server = app.listen(env.PORT, () => {
  logger.info(`api-gateway listening on port ${env.PORT} [${env.NODE_ENV}]`);
  for (const { prefix, service } of SERVICE_ROUTES) {
    logger.info(`  ${prefix} -> ${service} (${urls[service]})`);
  }
  logger.info(`  /socket.io -> notification-service (${urls['notification-service']})`);
});

// The websocket upgrade is handled outside of Express; app.ts hands back the
// handler it built alongside the Socket.io proxy middleware.
server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
  (app.get('wsUpgrade') as UpgradeHandler)(req, socket, head);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Keep-alive connections must not block shutdown forever.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
