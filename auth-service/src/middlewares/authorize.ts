import { NextFunction, Request, Response } from 'express';
import type { Role } from '../types/role';
import { ApiError } from '../utils/ApiError';

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Giriş yapmanız gerekiyor'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Bu işlem için yetkiniz yok'));
      return;
    }
    next();
  };
}
