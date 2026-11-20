import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err instanceof ApiError ? err.message : 'Internal Server Error';

  logger.error(err instanceof Error ? err.message : message, {
    statusCode,
    requestId: req.id,
    path: req.originalUrl,
    method: req.method,
    stack: statusCode >= 500 && err instanceof Error ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.id,
    ...(env.NODE_ENV !== 'production' && statusCode >= 500 && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
}
