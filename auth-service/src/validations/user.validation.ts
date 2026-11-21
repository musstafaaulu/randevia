import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { ROLES } from '../types/role';

export const userIdParamSchema = z.object({
  id: z.string().refine((value) => isValidObjectId(value), 'Geçersiz kullanıcı kimliği'),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
