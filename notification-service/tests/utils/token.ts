import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../../src/config/env';
import type { Role } from '../../src/types/role';

export function generateAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function newUserId(): string {
  return new Types.ObjectId().toString();
}
