import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../services/token.service';
import logger from '../utils/logger';

export const USER_ROOM_PREFIX = 'user:';
export const DOCTOR_ROOM_PREFIX = 'doctor:';

export const userRoom = (userId: string): string => `${USER_ROOM_PREFIX}${userId}`;
export const doctorRoom = (doctorId: string): string => `${DOCTOR_ROOM_PREFIX}${doctorId}`;

let io: Server | undefined;

function corsOrigins(): string | string[] {
  const origin = env.CORS_ORIGIN.trim();
  if (origin === '*') return '*';
  return origin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractToken(socket: Socket): string | undefined {
  const { auth, headers } = socket.handshake;
  const fromAuth = auth?.token as string | undefined;
  if (fromAuth) return fromAuth;

  const header = headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return undefined;
}

function isValidRoomId(value: unknown): value is string {
  // Loose shape check: good enough to keep clients from joining arbitrary
  // rooms with junk input without pulling in the appointment-service's
  // ObjectId validation.
  return typeof value === 'string' && /^[a-zA-Z0-9]{1,64}$/.test(value);
}

// Best-effort: a single notification-service instance works fine without
// Redis, so a broker outage must not block startup. Mirrors how the RabbitMQ
// connection is treated elsewhere in this service.
async function attachRedisAdapter(server: Server): Promise<void> {
  if (env.NODE_ENV === 'test') return;

  const pubClient: RedisClientType = createClient({ url: env.REDIS_URL });
  const subClient: RedisClientType = pubClient.duplicate();
  pubClient.on('error', (err: unknown) =>
    logger.warn('Redis pub client error', { error: err instanceof Error ? err.message : err }),
  );
  subClient.on('error', (err: unknown) =>
    logger.warn('Redis sub client error', { error: err instanceof Error ? err.message : err }),
  );

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter attached');
  } catch (err) {
    logger.warn('Could not attach Socket.io Redis adapter, running single-instance', {
      error: err instanceof Error ? err.message : err,
    });
  }
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: corsOrigins(), credentials: true },
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId } = socket.data.user as { id: string; role: string };
    void socket.join(userRoom(userId));

    socket.on('doctor:watch', (doctorId: unknown, ack?: () => void) => {
      if (isValidRoomId(doctorId)) void socket.join(doctorRoom(doctorId));
      ack?.();
    });

    socket.on('doctor:unwatch', (doctorId: unknown, ack?: () => void) => {
      if (isValidRoomId(doctorId)) void socket.leave(doctorRoom(doctorId));
      ack?.();
    });
  });

  void attachRedisAdapter(io);

  return io;
}

export function getIO(): Server | undefined {
  return io;
}
