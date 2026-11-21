import { randomUUID } from 'node:crypto';
import ms from 'ms';
import { env } from '../config/env';
import { IUser, User } from '../models/User.model';
import { generateOpaqueToken, hashToken, RefreshToken } from '../models/RefreshToken.model';
import { ApiError } from '../utils/ApiError';
import { generateAccessToken } from './token.service';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '../validations/auth.validation';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: IUser;
  tokens: TokenPair;
}

// Starts (login/register) or continues (refresh) one rotation chain: every
// refresh token born from the same login shares this family id, which is
// what lets reuse of an already-rotated token be told apart from a brand
// new session - see refresh() below.
async function issueTokens(user: IUser, family: string): Promise<TokenPair> {
  const refreshToken = generateOpaqueToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as Parameters<typeof ms>[0])),
  });

  return { accessToken: generateAccessToken(user._id.toString(), user.role), refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new ApiError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  const user = await User.create(input);
  const tokens = await issueTokens(user, randomUUID());

  return { user, tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'E-posta veya şifre hatalı');
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw new ApiError(401, 'E-posta veya şifre hatalı');
  }

  const tokens = await issueTokens(user, randomUUID());

  return { user, tokens };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { name: input.name },
    { new: true, runValidators: true },
  );
  if (!user) {
    throw new ApiError(404, 'Kullanıcı bulunamadı');
  }
  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'Kullanıcı bulunamadı');
  }

  const isMatch = await user.comparePassword(input.currentPassword);
  if (!isMatch) {
    throw new ApiError(401, 'Mevcut şifre hatalı');
  }

  user.password = input.newPassword; // hashed by the pre-save hook
  await user.save();
}

export async function refresh(token: string): Promise<AuthResult> {
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!record) {
    throw new ApiError(401, 'Oturum bilgisi bulunamadı, lütfen tekrar giriş yapın');
  }

  if (record.revokedAt) {
    // This exact token was already rotated away once before - someone is
    // replaying an old one, which only happens if it was stolen. Burn every
    // refresh token this user has, not just this family: better to force a
    // fresh login everywhere than let a possibly-compromised session linger.
    await RefreshToken.updateMany(
      { userId: record.userId, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new ApiError(401, 'Oturum geçersiz kılındı, lütfen tekrar giriş yapın');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'Oturumun süresi doldu, lütfen tekrar giriş yapın');
  }

  const user = await User.findById(record.userId);
  if (!user) {
    throw new ApiError(401, 'Kullanıcı artık mevcut değil');
  }

  record.revokedAt = new Date();
  await record.save();
  const tokens = await issueTokens(user, record.family);

  return { user, tokens };
}

// Revokes just this one token (this device/session) - a stolen-token replay
// revokes the whole user instead, see refresh() above. Silently succeeds
// when there is nothing to revoke, so logging out twice is never an error.
export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
}
