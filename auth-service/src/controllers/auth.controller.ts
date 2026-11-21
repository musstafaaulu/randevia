import { Request, Response } from 'express';
import { User } from '../models/User.model';
import {
  changePassword,
  login,
  logout,
  refresh,
  register,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  updateProfile,
  verifyEmail,
} from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE, setRefreshTokenCookie } from '../utils/cookies';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
} from '../validations/auth.validation';

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await register(req.body as RegisterInput);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(201).json({
    success: true,
    message: 'Kayıt başarılı',
    data: { user, accessToken: tokens.accessToken },
  });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await login(req.body as LoginInput);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(200).json({
    success: true,
    message: 'Giriş başarılı',
    data: { user, accessToken: tokens.accessToken },
  });
}

function refreshTokenFromRequest(req: Request): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE];
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  return cookieToken ?? bodyToken;
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = refreshTokenFromRequest(req);

  if (!token) {
    throw new ApiError(401, 'Oturum bilgisi bulunamadı, lütfen tekrar giriş yapın');
  }

  const { user, tokens } = await refresh(token);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(200).json({
    success: true,
    message: 'Oturum yenilendi',
    data: { user, accessToken: tokens.accessToken },
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  await logout(refreshTokenFromRequest(req));
  clearRefreshTokenCookie(res);
  res.status(200).json({ success: true, message: 'Çıkış yapıldı' });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, 'Giriş yapmanız gerekiyor');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Kullanıcı bulunamadı');
  }

  res.status(200).json({ success: true, data: { user } });
}

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  const user = await updateProfile(req.user!.id, req.body as UpdateProfileInput);
  res.status(200).json({ success: true, message: 'Profil güncellendi', data: { user } });
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  await changePassword(req.user!.id, req.body as ChangePasswordInput);
  res.status(200).json({ success: true, message: 'Şifre güncellendi' });
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const { token } = req.body as VerifyEmailInput;
  await verifyEmail(token);
  res.status(200).json({ success: true, message: 'E-posta adresiniz doğrulandı' });
}

export async function resendVerificationHandler(req: Request, res: Response): Promise<void> {
  await resendVerificationEmail(req.user!.id);
  res.status(200).json({ success: true, message: 'Doğrulama e-postası yeniden gönderildi' });
}

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  await requestPasswordReset(req.body as ForgotPasswordInput);
  res.status(200).json({
    success: true,
    message: 'E-posta adresiniz sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi',
  });
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  await resetPassword(req.body as ResetPasswordInput);
  res.status(200).json({ success: true, message: 'Şifreniz sıfırlandı, tekrar giriş yapabilirsiniz' });
}
