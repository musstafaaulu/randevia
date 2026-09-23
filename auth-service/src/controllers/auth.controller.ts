import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { login, refresh, register } from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { REFRESH_TOKEN_COOKIE, setRefreshTokenCookie } from '../utils/cookies';
import type { LoginInput, RegisterInput } from '../validations/auth.validation';

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await register(req.body as RegisterInput);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { user, accessToken: tokens.accessToken },
  });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await login(req.body as LoginInput);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user, accessToken: tokens.accessToken },
  });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE];
  const bodyToken = (req.body as { refreshToken?: string }).refreshToken;
  const token = cookieToken ?? bodyToken;

  if (!token) {
    throw new ApiError(401, 'Refresh token missing');
  }

  const { user, tokens } = await refresh(token);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(200).json({
    success: true,
    message: 'Token refreshed',
    data: { user, accessToken: tokens.accessToken },
  });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({ success: true, data: { user } });
}
