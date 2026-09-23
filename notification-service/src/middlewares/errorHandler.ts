import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

function isDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.flatten().fieldErrors;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, validatorError]) => [field, validatorError.message]),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    message = `${Object.keys(err.keyValue ?? {})[0] ?? 'Field'} already exists`;
  } else if (err instanceof Error) {
    message = err.message;
  }

  logger.error(message, {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { stack: err.stack } : {}),
  });
}
