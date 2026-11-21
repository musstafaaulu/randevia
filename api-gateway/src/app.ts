import cors, { CorsOptions } from 'cors';
import express, { Application, Request } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, GatewayConfig } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { createRateLimiters } from './middlewares/rateLimiters';
import { requestId } from './middlewares/requestId';
import { createServiceProxy } from './proxy/createServiceProxy';
import { createWsProxy } from './proxy/createWsProxy';
import { SERVICE_ROUTES, ServiceName, serviceUrls } from './proxy/services';
import { createHealthRoutes } from './routes/health.routes';
import logger from './utils/logger';

const CREDENTIAL_ENDPOINTS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

function corsOptions(origin: string): CorsOptions {
  const exposedHeaders = ['X-Request-Id'];
  if (origin.trim() === '*') return { origin: '*', exposedHeaders };

  const allowed = origin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return { origin: allowed, credentials: true, exposedHeaders };
}

morgan.token('request-id', (req) => (req as Request).id);

export function createApp(config: GatewayConfig = env): Application {
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  app.use(cors(corsOptions(config.CORS_ORIGIN)));
  app.use(
    morgan(
      ':request-id :remote-addr ":method :url" :status :res[content-length] - :response-time ms',
      { stream: { write: (message: string) => logger.http(message.trim()) } },
    ),
  );

  // No body parser on purpose: request bodies are streamed to the services as-is.
  const limiters = createRateLimiters(config);
  app.post(CREDENTIAL_ENDPOINTS, limiters.credentials);
  app.use('/api/v1/health', createHealthRoutes(config));
  app.use(limiters.global);

  const urls = serviceUrls(config);
  const prefixesByService = new Map<ServiceName, string[]>();
  for (const { prefix, service } of SERVICE_ROUTES) {
    prefixesByService.set(service, [...(prefixesByService.get(service) ?? []), prefix]);
  }
  for (const [service, prefixes] of prefixesByService) {
    app.use(
      createServiceProxy({
        service,
        target: urls[service],
        prefixes,
        timeoutMs: config.PROXY_TIMEOUT_MS,
      }),
    );
  }

  // Socket.io never goes through /api/v1; its websocket upgrade bypasses
  // Express entirely, so server.ts wires the "upgrade" handler kept here.
  const wsProxy = createWsProxy(urls['notification-service'], '/socket.io');
  app.use(wsProxy.middleware);
  app.set('wsUpgrade', wsProxy.upgrade);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
