import { apiRequest } from './client';
import type { Appointment } from '../types/api';

export function createAppointment(input: {
  doctorId: string;
  date: string;
}): Promise<{ appointment: Appointment }> {
  return apiRequest('/api/v1/appointments', { method: 'POST', body: input });
}

export function listMyAppointments(): Promise<{ appointments: Appointment[] }> {
  return apiRequest('/api/v1/appointments/me');
}

export function confirmAppointment(id: string): Promise<{ appointment: Appointment }> {
  return apiRequest(`/api/v1/appointments/${id}/confirm`, { method: 'PATCH' });
}

export function cancelAppointment(id: string): Promise<{ appointment: Appointment }> {
  return apiRequest(`/api/v1/appointments/${id}/cancel`, { method: 'PATCH' });
}
