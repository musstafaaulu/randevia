import { IUser, User } from '../models/User.model';
import { ApiError } from '../utils/ApiError';
import { generateTokenPair, TokenPair, verifyRefreshToken } from './token.service';
import type { LoginInput, RegisterInput } from '../validations/auth.validation';

export interface AuthResult {
  user: IUser;
  tokens: TokenPair;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new ApiError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  const user = await User.create(input);
  const tokens = generateTokenPair(user._id.toString(), user.role);

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

  const tokens = generateTokenPair(user._id.toString(), user.role);

  return { user, tokens };
}

export async function refresh(token: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(token);

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'Kullanıcı artık mevcut değil');
  }

  const tokens = generateTokenPair(user._id.toString(), user.role);

  return { user, tokens };
}
