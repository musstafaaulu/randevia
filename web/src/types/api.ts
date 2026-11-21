export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Doctor {
  _id: string;
  userId: string;
  name: string;
  specialty: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  _id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  _id: string;
  patientId: string;
  doctorId: string;
  date: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentEventType =
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'appointment.cancelled';

export interface AppNotification {
  _id: string;
  recipientId: string;
  recipientRole: 'patient' | 'doctor';
  type: AppointmentEventType;
  title: string;
  message: string;
  appointmentId: string;
  appointmentDate: string;
  read: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserStats {
  total: number;
  byRole: Record<Role, number>;
}

export interface AppointmentStats {
  totalAppointments: number;
  totalDoctors: number;
  byStatus: Record<AppointmentStatus, number>;
  dailyCounts: { date: string; count: number }[];
}

export interface SlotUpdatedPayload {
  doctorId: string;
  appointmentId: string;
  date: string;
  status: string;
  eventType: AppointmentEventType;
}
