import { randomUUID } from 'node:crypto';
import type { AppointmentEvent } from '../../src/events/appointment.events';
import { newUserId } from './token';

export function makeEvent(overrides: Partial<AppointmentEvent> = {}): AppointmentEvent {
  return {
    eventId: randomUUID(),
    eventType: 'appointment.created',
    occurredAt: new Date().toISOString(),
    appointmentId: newUserId(),
    patientId: newUserId(),
    doctorId: newUserId(),
    doctorUserId: newUserId(),
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    ...overrides,
  };
}
