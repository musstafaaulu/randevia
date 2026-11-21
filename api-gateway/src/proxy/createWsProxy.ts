import type { IncomingMessage, ClientRequest } from 'node:http';
import type { Socket } from 'node:net';
import type { RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../utils/logger';

export type UpgradeHandler = (req: IncomingMessage, socket: Socket, head: Buffer) => void;

export interface WsProxy {
  // Handles the Socket.io polling transport (plain HTTP GET/POST).
  middleware: RequestHandler;
  // Must be wired to the HTTP server's "upgrade" event for the websocket
  // transport, which never goes through Express's request/response cycle.
  upgrade: UpgradeHandler;
}

// A single entry point means the browser only ever talks to the gateway,
// websockets included; it forwards the Socket.io handshake to
// notification-service unchanged, on whichever path it is served from.
export function createWsProxy(target: string, path: string): WsProxy {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathFilter: path,
    on: {
      proxyReq: (proxyReq: ClientRequest, req) => {
        proxyReq.on('timeout', () => req.destroy());
      },
      error: (err, _req, socketOrRes) => {
        logger.error('WebSocket proxy to notification-service failed', { error: err.message });
        if ('destroy' in socketOrRes) (socketOrRes as Socket).destroy();
      },
    },
  });

  return {
    middleware: proxy as unknown as RequestHandler,
    upgrade: (proxy as unknown as { upgrade: UpgradeHandler }).upgrade,
  };
}
