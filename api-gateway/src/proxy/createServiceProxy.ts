import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Request, RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../utils/logger';
import { matchesPrefix, ServiceName } from './services';

export interface ServiceProxyOptions {
  service: ServiceName;
  target: string;
  prefixes: string[];
  timeoutMs: number;
}

// CORS is decided once, at the gateway. The services keep their own CORS
// middleware for direct access; drop its headers so they can neither
// contradict nor duplicate the gateway's.
function stripCorsHeaders(proxyRes: IncomingMessage): void {
  for (const header of Object.keys(proxyRes.headers)) {
    if (header.startsWith('access-control-')) delete proxyRes.headers[header];
  }
}

export function createServiceProxy({
  service,
  target,
  prefixes,
  timeoutMs,
}: ServiceProxyOptions): RequestHandler {
  const timedOut = new WeakSet<IncomingMessage>();

  return createProxyMiddleware<Request, ServerResponse>({
    target,
    changeOrigin: true,
    // Adds X-Forwarded-For/-Proto/-Host so the services see the real client.
    xfwd: true,
    proxyTimeout: timeoutMs,
    pathFilter: (pathname) => prefixes.some((prefix) => matchesPrefix(pathname, prefix)),
    on: {
      proxyReq: (proxyReq: ClientRequest, req) => {
        proxyReq.on('timeout', () => timedOut.add(req));
      },
      proxyRes: (proxyRes) => stripCorsHeaders(proxyRes),
      // Registering an error handler also disables http-proxy-middleware's
      // default plain-text error response.
      error: (err, req, res) => {
        const isTimeout = timedOut.has(req);
        const statusCode = isTimeout ? 504 : 502;
        logger.error(`Proxy to ${service} failed`, {
          requestId: req.id,
          method: req.method,
          path: req.originalUrl,
          statusCode,
          error: err.message,
        });

        // For WebSocket upgrades res is a raw socket; there is nothing to answer.
        if (!('writeHead' in res)) {
          (res as Socket).destroy();
          return;
        }
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: false,
            message: isTimeout
              ? `${service} zamanında yanıt vermedi`
              : `${service} şu anda kullanılamıyor`,
            requestId: req.id,
          }),
        );
      },
    },
  }) as unknown as RequestHandler;
}
