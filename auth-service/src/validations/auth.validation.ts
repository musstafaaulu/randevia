import { z } from 'zod';
import { SELF_REGISTERABLE_ROLES } from '../types/role';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ad en az 2 karakter olmalı').max(100),
  email: z.string().trim().toLowerCase().email('Geçersiz e-posta formatı'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı').max(72),
  role: z.enum(SELF_REGISTERABLE_ROLES).optional().default('patient'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçersiz e-posta formatı'),
  password: z.string().min(1, 'Şifre gerekli'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Ad en az 2 karakter olmalı').max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı').max(72),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token gerekli'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçersiz e-posta formatı'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token gerekli'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı').max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
