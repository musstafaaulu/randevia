import { IUser, User } from '../models/User.model';
import { ApiError } from '../utils/ApiError';
import { generateTokenPair, TokenPair, verifyRefreshToken } from './token.service';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '../validations/auth.validation';

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
  const payload = verifyRefreshToken(token);

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'Kullanıcı artık mevcut değil');
  }

  const tokens = generateTokenPair(user._id.toString(), user.role);

  return { user, tokens };
}
