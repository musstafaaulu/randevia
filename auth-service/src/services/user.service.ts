import { env } from '../config/env';
import { IUser, User } from '../models/User.model';
import type { Role } from '../types/role';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import type { ListUsersQuery } from '../validations/user.validation';

export interface UserPage {
  users: IUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listUsers({ role, page, limit }: ListUsersQuery): Promise<UserPage> {
  const filter = role ? { role } : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// The new role takes effect in the user's next access token (at the latest
// after JWT_ACCESS_EXPIRES_IN, or immediately on /refresh).
export async function updateUserRole(actorId: string, userId: string, role: Role): Promise<IUser> {
  if (actorId === userId) {
    // Guards against an admin locking themselves (and possibly everyone) out.
    throw new ApiError(400, 'Admins cannot change their own role');
  }

  const user = await User.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  logger.info('User role updated', { actorId, userId, role });
  return user;
}

// Self-registration only creates patients, so the first admin is bootstrapped
// from ADMIN_EMAIL / ADMIN_PASSWORD on startup. An existing account with that
// email is promoted; its password is left untouched.
export async function ensureAdminUser(): Promise<void> {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name } = env;
  if (!email || !password) return;

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      logger.info('Existing user promoted to admin', { email });
    }
    return;
  }

  await User.create({ name, email, password, role: 'admin' });
  logger.info('Admin user created', { email });
}
