import { Document, model, Schema, Types } from 'mongoose';

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface IAppointment extends Document {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  date: Date;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Patient id is required'],
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor id is required'],
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'pending',
    },
  },
  { timestamps: true },
);

// Prevents double-booking the same doctor at the same date/time while an
// appointment is still active; cancelled/completed slots free up the time.
appointmentSchema.index(
  { doctorId: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } },
);

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
