import { env } from '../config/env';
import type { AppointmentEvent, AppointmentEventType } from '../events/appointment.events';
import type { RecipientRole } from '../models/Notification.model';

export interface NotificationDraft {
  recipientId: string;
  recipientRole: RecipientRole;
  title: string;
  message: string;
}

type Template = Record<RecipientRole, (date: string) => { title: string; message: string }>;

const TEMPLATES: Record<AppointmentEventType, Template> = {
  'appointment.created': {
    patient: (date) => ({
      title: 'Appointment request received',
      message: `Your appointment request for ${date} has been received and is awaiting the doctor's confirmation.`,
    }),
    doctor: (date) => ({
      title: 'New appointment request',
      message: `A patient has requested an appointment with you on ${date}.`,
    }),
  },
  'appointment.confirmed': {
    patient: (date) => ({
      title: 'Appointment confirmed',
      message: `Your appointment on ${date} has been confirmed by the doctor.`,
    }),
    doctor: (date) => ({
      title: 'Appointment confirmed',
      message: `You confirmed the appointment on ${date}.`,
    }),
  },
  'appointment.cancelled': {
    patient: (date) => ({
      title: 'Appointment cancelled',
      message: `Your appointment on ${date} has been cancelled.`,
    }),
    doctor: (date) => ({
      title: 'Appointment cancelled',
      message: `The appointment on ${date} has been cancelled by the patient.`,
    }),
  },
};

export function formatAppointmentDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: env.NOTIFICATION_TIMEZONE,
  }).format(new Date(isoDate));
}

export function buildNotificationDrafts(event: AppointmentEvent): NotificationDraft[] {
  const template = TEMPLATES[event.eventType];
  const date = formatAppointmentDate(event.date);

  return [
    { recipientId: event.patientId, recipientRole: 'patient', ...template.patient(date) },
    { recipientId: event.doctorUserId, recipientRole: 'doctor', ...template.doctor(date) },
  ];
}
