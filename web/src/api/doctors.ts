import { apiRequest } from './client';
import type { Availability, Doctor } from '../types/api';

export function listDoctors(): Promise<{ doctors: Doctor[] }> {
  return apiRequest('/api/v1/doctors');
}

export function getDoctor(
  id: string,
): Promise<{ doctor: Doctor; availability: Availability[]; bookedSlots: string[] }> {
  return apiRequest(`/api/v1/doctors/${id}`);
}

export function upsertMyDoctorProfile(input: {
  name: string;
  specialty: string;
  bio?: string;
}): Promise<{ doctor: Doctor }> {
  return apiRequest('/api/v1/doctors/me', { method: 'POST', body: input });
}

export function addMyAvailability(input: {
  startTime: string;
  endTime: string;
}): Promise<{ availability: Availability }> {
  return apiRequest('/api/v1/doctors/me/availability', { method: 'POST', body: input });
}
