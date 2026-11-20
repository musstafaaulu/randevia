import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';

export interface Upstream {
  url: string;
  close: () => Promise<void>;
}

function listen(app: express.Application): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function urlOf(server: Server): string {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

// A stand-in for a real service: echoes back what reached it, so tests can
// assert on the path, headers and body the gateway forwarded.
export async function startUpstream(name: string): Promise<Upstream> {
  const app = express();
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, service: name, status: 'ok' });
  });
  app.get('/api/v1/doctors/slow', (_req, res) => {
    setTimeout(() => res.json({ late: true }), 1000);
  });
  app.all('/{*path}', (req, res) => {
    res
      .status(req.get('x-test-status') ? Number(req.get('x-test-status')) : 200)
      .set('Access-Control-Allow-Origin', 'http://upstream-says-anything.example')
      .cookie('refreshToken', 'abc', { httpOnly: true, path: '/api/v1/auth' })
      .json({
        service: name,
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body as unknown,
      });
  });

  const server = await listen(app);
  return { url: urlOf(server), close: () => close(server) };
}

// A URL on which nothing is listening.
export async function unusedUrl(): Promise<string> {
  const server = await listen(express());
  const url = urlOf(server);
  await close(server);
  return url;
}
