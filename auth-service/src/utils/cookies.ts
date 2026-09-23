import { Response } from 'express';
import ms from 'ms';
import { env } from '../config/env';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_PATH = '/api/v1/auth';

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_TOKEN_PATH,
    maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as Parameters<typeof ms>[0]),
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_TOKEN_PATH,
  });
}
