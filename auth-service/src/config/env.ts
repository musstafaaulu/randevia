import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  CORS_ORIGIN: z.string().default('*'),
  // Reverse proxies in front of the service (1 behind the api-gateway), so
  // req.ip and the rate limiter use the client IP from X-Forwarded-For.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  // Optional bootstrap admin, created on startup when both are set.
  ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).max(72).optional(),
  ADMIN_NAME: z.string().trim().min(2).max(100).default('Randevia Admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
