import { Document, model, Schema, Types } from 'mongoose';

export interface IDoctor extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  specialty: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'User id is required'],
      unique: true,
    },
    // Denormalized from auth-service's User at profile-save time: this
    // service never calls auth-service directly, and the JWT it verifies
    // carries only the user id and role, not a display name.
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    specialty: {
      type: String,
      required: [true, 'Specialty is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
