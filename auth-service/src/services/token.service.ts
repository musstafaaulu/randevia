import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types/role';

// Refresh tokens are no longer JWTs issued here - they're opaque, database-
// backed tokens (see models/RefreshToken.model.ts) so they can be rotated
// and revoked. This file only ever signs/verifies the short-lived, stateless
// access token.

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
}

export function generateAccessToken(sub: string, role: Role): string {
  return jwt.sign({ sub, role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new ApiError(401, 'Oturumun süresi doldu, lütfen tekrar giriş yapın');
  }
  if (payload.type !== 'access') throw new ApiError(401, 'Geçersiz oturum bilgisi');
  return payload;
}
