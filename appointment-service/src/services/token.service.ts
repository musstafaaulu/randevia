import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types/role';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new ApiError(401, 'Oturumun süresi doldu, lütfen tekrar giriş yapın');
  }

  if (payload.type !== 'access') {
    throw new ApiError(401, 'Geçersiz oturum bilgisi');
  }

  return payload;
}
