import { Document, model, Schema, Types } from 'mongoose';
import { generateOpaqueToken, hashToken } from '../utils/tokens';

// Refresh tokens are opaque random strings, not JWTs: rotation and reuse
// detection both need a database lookup anyway (to check revokedAt), so a
// self-verifying JWT buys nothing here and can't be revoked on its own.
// Only the hash is ever stored, so a database leak alone doesn't hand out
// usable tokens.
export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  // Every token born from the same login shares a family id. Rotating a
  // token keeps the family; logging in again starts a new one. Reusing a
  // token that was already rotated away is the signal that the family's
  // token was stolen, so the whole family (and in this app's case, the
  // whole user - see auth.service.ts) gets revoked.
  family: string;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Kullanıcı kimliği gerekli'],
    },
    tokenHash: {
      type: String,
      required: [true, 'Token özeti gerekli'],
      unique: true,
    },
    family: {
      type: String,
      required: [true, 'Token ailesi gerekli'],
    },
    revokedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Son kullanma tarihi gerekli'],
    },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ family: 1 });
// Mongo's TTL monitor sweeps these away on its own once they expire, revoked
// or not - there is no need to keep an expired token's audit trail forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);

export { generateOpaqueToken, hashToken };
