import { randomUUID } from 'node:crypto';
import type { AppointmentStatus, IAppointment } from '../models/Appointment.model';

export const APPOINTMENT_EVENT_TYPES = [
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
] as const;

export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

export interface AppointmentEvent {
  eventId: string;
  eventType: AppointmentEventType;
  occurredAt: string;
  appointmentId: string;
  patientId: string;
  // Doctor profile id in this service; doctorUserId is the doctor's auth user
  // id, which consumers need to address the doctor (it's the JWT subject).
  doctorId: string;
  doctorUserId: string;
  date: string;
  status: AppointmentStatus;
}

export function buildAppointmentEvent(
  eventType: AppointmentEventType,
  appointment: IAppointment,
  doctorUserId: string,
): AppointmentEvent {
  return {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    appointmentId: appointment._id.toString(),
    patientId: appointment.patientId.toString(),
    doctorId: appointment.doctorId.toString(),
    doctorUserId,
    date: appointment.date.toISOString(),
    status: appointment.status,
  };
}
