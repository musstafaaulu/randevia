import { Document, model, Schema, Types } from 'mongoose';

export const VERIFICATION_TOKEN_PURPOSES = ['email_verify', 'password_reset'] as const;
export type VerificationTokenPurpose = (typeof VERIFICATION_TOKEN_PURPOSES)[number];

// One model for both flows since they share the exact same shape (an opaque,
// hashed, single-use, expiring token tied to a user); `purpose` keeps a
// password-reset token from being usable to verify an email and vice versa.
export interface IVerificationToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  purpose: VerificationTokenPurpose;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const verificationTokenSchema = new Schema<IVerificationToken>(
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
    purpose: {
      type: String,
      enum: VERIFICATION_TOKEN_PURPOSES,
      required: [true, 'Token amacı gerekli'],
    },
    usedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Son kullanma tarihi gerekli'],
    },
  },
  { timestamps: true },
);

verificationTokenSchema.index({ userId: 1, purpose: 1 });
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationToken = model<IVerificationToken>(
  'VerificationToken',
  verificationTokenSchema,
);
