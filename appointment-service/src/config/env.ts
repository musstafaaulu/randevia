import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('randevia.events'),
  CORS_ORIGIN: z.string().default('*'),
  // Reminder job (see jobs/reminderJob.ts): fires once per confirmed
  // appointment whose date is within REMINDER_LEAD_TIME_MS of now, checking
  // every REMINDER_CHECK_INTERVAL_MS.
  REMINDER_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  REMINDER_LEAD_TIME_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  // Reverse proxies in front of the service (1 behind the api-gateway), so
  // req.ip and the rate limiter use the client IP from X-Forwarded-For.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

// Placeholder secrets like "changeme" must never reach production: anyone who
// knows a JWT secret can forge tokens for any user and role.
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const PRODUCTION_SECRETS = ['JWT_ACCESS_SECRET'] as const;

const envSchema = baseSchema.superRefine((config, ctx) => {
  if (config.NODE_ENV !== 'production') return;
  for (const key of PRODUCTION_SECRETS) {
    if (config[key].length < MIN_PRODUCTION_SECRET_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
