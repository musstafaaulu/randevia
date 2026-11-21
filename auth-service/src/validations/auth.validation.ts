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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
