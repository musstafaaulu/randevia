import { z } from 'zod';
import { zObjectId } from '../utils/objectId';

// Contract published by appointment-service to the topic exchange; the event
// type doubles as the routing key.
export const APPOINTMENT_EVENT_TYPES = [
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
] as const;

export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

export const appointmentEventSchema = z.object({
  eventId: z.string().min(1).max(100),
  eventType: z.enum(APPOINTMENT_EVENT_TYPES),
  occurredAt: z.iso.datetime(),
  appointmentId: zObjectId,
  patientId: zObjectId,
  doctorId: zObjectId,
  doctorUserId: zObjectId,
  date: z.iso.datetime(),
  status: z.string().min(1),
});

export type AppointmentEvent = z.infer<typeof appointmentEventSchema>;
