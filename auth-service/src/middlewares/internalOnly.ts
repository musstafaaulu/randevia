import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token';

// Guards service-to-service routes (currently just notification-service
// looking up a recipient's e-mail address). The docker network already keeps
// these services unreachable from outside, but the gateway proxies this
// service's whole /api/v1/auth prefix, so this header is a second, explicit
// gate rather than relying on network topology alone.
export function internalOnly(req: Request, _res: Response, next: NextFunction): void {
  if (req.header(INTERNAL_TOKEN_HEADER) !== env.INTERNAL_SERVICE_TOKEN) {
    next(new ApiError(401, 'Yetkisiz'));
    return;
  }
  next();
}
