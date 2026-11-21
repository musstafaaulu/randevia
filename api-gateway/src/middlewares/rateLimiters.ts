import { Request, Response } from 'express';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import type { GatewayConfig } from '../config/env';

function onLimitReached(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    message: 'Çok fazla istek gönderdiniz, lütfen biraz sonra tekrar deneyin',
    requestId: req.id,
  });
}

// Each call creates a limiter with its own in-memory store.
export function createRateLimiters(config: GatewayConfig): {
  global: RateLimitRequestHandler;
  credentials: RateLimitRequestHandler;
} {
  const common = {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: onLimitReached,
  } as const;

  return {
    global: rateLimit({ ...common, limit: config.RATE_LIMIT_MAX }),
    // Brute-force protection for endpoints that take credentials.
    credentials: rateLimit({ ...common, limit: config.AUTH_RATE_LIMIT_MAX }),
  };
}
