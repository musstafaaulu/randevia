import { Document, model, Schema, Types } from 'mongoose';

export interface IAvailability extends Document {
  _id: Types.ObjectId;
  doctorId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySchema = new Schema<IAvailability>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor id is required'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
  },
  { timestamps: true },
);

availabilitySchema.index({ doctorId: 1, startTime: 1 });

export const Availability = model<IAvailability>('Availability', availabilitySchema);
