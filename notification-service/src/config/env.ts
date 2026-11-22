import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4002),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
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
  // Mail delivery for appointment notifications (MailHog in development).
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default('Randevia <no-reply@randevia.local>'),
  // auth-service's internal endpoint for resolving a recipient's e-mail
  // address, and the shared secret that guards it.
  AUTH_SERVICE_URL: z.string().default('http://localhost:4000'),
  INTERNAL_SERVICE_TOKEN: z.string().min(1, 'INTERNAL_SERVICE_TOKEN is required'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

// Placeholder secrets like "changeme" must never reach production: anyone who
// knows a JWT secret can forge tokens for any user and role.
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const PRODUCTION_SECRETS = ['JWT_ACCESS_SECRET', 'INTERNAL_SERVICE_TOKEN'] as const;

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
