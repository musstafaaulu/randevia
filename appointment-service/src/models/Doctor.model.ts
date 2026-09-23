import { Document, model, Schema, Types } from 'mongoose';

export interface IDoctor extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
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
