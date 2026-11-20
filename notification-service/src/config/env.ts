import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4002),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('randevia.events'),
  NOTIFICATION_QUEUE: z.string().min(1).default('notification-service.appointment-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(10),
  MESSAGE_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  MESSAGE_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),
  NOTIFICATION_TIMEZONE: z.string().default('Europe/Istanbul'),
  CORS_ORIGIN: z.string().default('*'),
  // Reverse proxies in front of the service (1 behind the api-gateway), so
  // req.ip and the rate limiter use the client IP from X-Forwarded-For.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
