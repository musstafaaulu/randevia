import { API_BASE_URL } from '../config';
import { apiRequest, ApiError, getAccessToken } from './client';
import type { Appointment, AppointmentStats } from '../types/api';

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

export function getAppointmentStats(): Promise<AppointmentStats> {
  return apiRequest('/api/v1/appointments/stats');
}

// Not apiRequest: that always parses the body as JSON, and this response is
// a calendar file. Triggers a real browser download via a throwaway object
// URL instead of returning the content, since nothing else needs it.
export async function downloadAppointmentIcs(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${id}/ics`, {
    credentials: 'include',
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Takvim dosyası indirilemedi');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `randevu-${id}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
