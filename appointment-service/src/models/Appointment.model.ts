import { Document, model, Schema, Types } from 'mongoose';

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface IAppointment extends Document {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  date: Date;
  status: AppointmentStatus;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Hasta kimliği gerekli'],
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doktor kimliği gerekli'],
    },
    date: {
      type: Date,
      required: [true, 'Randevu tarihi gerekli'],
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'pending',
    },
    // Set once the 24h-ahead reminder job (see reminderJob.ts) has fired for
    // this appointment, so a confirmed appointment is only ever reminded once
    // no matter how many times the job's tick runs before that.
    reminderSentAt: {
      type: Date,
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

// What reminderJob.ts scans on every tick.
appointmentSchema.index({ status: 1, reminderSentAt: 1, date: 1 });

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
