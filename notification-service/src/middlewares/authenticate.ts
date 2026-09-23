import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { ApiError } from '../utils/ApiError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}
