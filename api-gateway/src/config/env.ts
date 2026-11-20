import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_SERVICE_URL: z.url().default('http://localhost:4000'),
  APPOINTMENT_SERVICE_URL: z.url().default('http://localhost:4001'),
  NOTIFICATION_SERVICE_URL: z.url().default('http://localhost:4002'),
  // Comma-separated list of allowed origins, or * to allow any origin
  // (credentials, i.e. the refresh-token cookie, are only allowed with a list).
  CORS_ORIGIN: z.string().default('*'),
  // Number of reverse proxies in front of the gateway (0 = clients connect directly).
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  // Stricter limit for credential endpoints (login, register, refresh).
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type GatewayConfig = typeof env;
