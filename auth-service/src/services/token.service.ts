import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types/role';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: Role;
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function sign(payload: Record<string, unknown>, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function generateTokenPair(sub: string, role: Role): TokenPair {
  const accessToken = sign(
    { sub, role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );
  const refreshToken = sign(
    { sub, role, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN,
  );
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type !== 'access') throw new ApiError(401, 'Geçersiz oturum bilgisi');
  return payload as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh') throw new ApiError(401, 'Geçersiz oturum bilgisi');
  return payload as RefreshTokenPayload;
}

function verify(token: string, secret: string): AccessTokenPayload | RefreshTokenPayload {
  try {
    return jwt.verify(token, secret) as AccessTokenPayload | RefreshTokenPayload;
  } catch {
    throw new ApiError(401, 'Oturumun süresi doldu, lütfen tekrar giriş yapın');
  }
}
