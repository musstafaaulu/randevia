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
      title: 'Randevu talebiniz alındı',
      message: `${date} tarihli randevu talebiniz alındı ve doktorun onayı bekleniyor.`,
    }),
    doctor: (date) => ({
      title: 'Yeni randevu talebi',
      message: `Bir hasta sizden ${date} tarihinde randevu talep etti.`,
    }),
  },
  'appointment.confirmed': {
    patient: (date) => ({
      title: 'Randevunuz onaylandı',
      message: `${date} tarihli randevunuz doktor tarafından onaylandı.`,
    }),
    doctor: (date) => ({
      title: 'Randevuyu onayladınız',
      message: `${date} tarihli randevuyu onayladınız.`,
    }),
  },
  'appointment.cancelled': {
    patient: (date) => ({
      title: 'Randevunuz iptal edildi',
      message: `${date} tarihli randevunuz iptal edildi.`,
    }),
    doctor: (date) => ({
      title: 'Randevu iptal edildi',
      message: `${date} tarihli randevu hasta tarafından iptal edildi.`,
    }),
  },
};

export function formatAppointmentDate(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeZone: env.NOTIFICATION_TIMEZONE,
  }).format(date);
  const timePart = new Intl.DateTimeFormat('tr-TR', {
    timeStyle: 'short',
    timeZone: env.NOTIFICATION_TIMEZONE,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

export function buildNotificationDrafts(event: AppointmentEvent): NotificationDraft[] {
  const template = TEMPLATES[event.eventType];
  const date = formatAppointmentDate(event.date);

  return [
    { recipientId: event.patientId, recipientRole: 'patient', ...template.patient(date) },
    { recipientId: event.doctorUserId, recipientRole: 'doctor', ...template.doctor(date) },
  ];
}
