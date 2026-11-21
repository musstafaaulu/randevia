import { Document, model, Schema, Types } from 'mongoose';
import { APPOINTMENT_EVENT_TYPES, AppointmentEventType } from '../events/appointment.events';

export const RECIPIENT_ROLES = ['patient', 'doctor'] as const;
export const NOTIFICATION_CHANNELS = ['email'] as const;
export const NOTIFICATION_STATUSES = ['pending', 'sent'] as const;

export type RecipientRole = (typeof RECIPIENT_ROLES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  recipientRole: RecipientRole;
  channel: NotificationChannel;
  type: AppointmentEventType;
  title: string;
  message: string;
  eventId: string;
  appointmentId: Types.ObjectId;
  appointmentDate: Date;
  status: NotificationStatus;
  sentAt?: Date;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Recipient id is required'],
    },
    recipientRole: {
      type: String,
      enum: RECIPIENT_ROLES,
      required: [true, 'Recipient role is required'],
    },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      default: 'email',
    },
    type: {
      type: String,
      enum: APPOINTMENT_EVENT_TYPES,
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    eventId: {
      type: String,
      required: [true, 'Event id is required'],
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Appointment id is required'],
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: 'pending',
    },
    sentAt: {
      type: Date,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Idempotency: a redelivered event must never produce a second notification
// for the same recipient.
notificationSchema.index({ eventId: 1, recipientRole: 1 }, { unique: true });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

export const Notification = model<INotification>('Notification', notificationSchema);
