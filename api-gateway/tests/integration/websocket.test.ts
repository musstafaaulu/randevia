import { createServer, type Server as HttpServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Socket } from 'node:net';
import { Server as SocketIoServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import type { UpgradeHandler } from '../../src/proxy/createWsProxy';

// Stands in for notification-service's Socket.io server: real enough to
// prove the gateway forwards the websocket upgrade, not just plain HTTP.
function startUpstreamSocketServer(): Promise<{
  url: string;
  io: SocketIoServer;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const io = new SocketIoServer(httpServer, { path: '/socket.io', cors: { origin: '*' } });
    httpServer.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        io,
        close: () =>
          new Promise((res) => {
            io.close();
            httpServer.close(() => res());
          }),
      });
    });
  });
}

function startGateway(
  notificationServiceUrl: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const app = createApp({ ...env, NOTIFICATION_SERVICE_URL: notificationServiceUrl });
    const httpServer: HttpServer = createServer(app);
    httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      (app.get('wsUpgrade') as UpgradeHandler)(req, socket, head);
    });
    httpServer.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => httpServer.close(() => res())),
      });
    });
  });
}

describe('Socket.io websocket proxying', () => {
  it('forwards the websocket handshake and messages through to notification-service', async () => {
    const upstream = await startUpstreamSocketServer();
    const gateway = await startGateway(upstream.url);

    const serverSawConnection = new Promise<void>((resolve) => {
      upstream.io.on('connection', (socket) => {
        socket.on('ping-gateway', (payload: string) => socket.emit('pong-gateway', payload));
      });
      resolve();
    });
    await serverSawConnection;

    const client: ClientSocket = ioClient(gateway.url, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('connect_error', reject);
      });

      const reply = await new Promise<string>((resolve) => {
        client.once('pong-gateway', resolve);
        client.emit('ping-gateway', 'through-the-gateway');
      });

      expect(reply).toBe('through-the-gateway');
    } finally {
      client.disconnect();
      await gateway.close();
      await upstream.close();
    }
  });
});
