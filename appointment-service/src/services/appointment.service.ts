import mongoose from 'mongoose';
import { AppointmentEventType, buildAppointmentEvent } from '../events/appointment.events';
import {
  APPOINTMENT_STATUSES,
  Appointment,
  AppointmentStatus,
  IAppointment,
} from '../models/Appointment.model';
import { Doctor } from '../models/Doctor.model';
import { OutboxEvent } from '../models/OutboxEvent.model';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types/role';
import type { CreateAppointmentInput } from '../validations/appointment.validation';

const STATS_DAYS = 14;

export interface AppointmentStats {
  totalAppointments: number;
  totalDoctors: number;
  byStatus: Record<AppointmentStatus, number>;
  dailyCounts: { date: string; count: number }[];
}

// Written in the same transaction as the appointment change it describes
// (see OutboxEvent.model.ts): the request never talks to RabbitMQ directly
// any more, so it can never fail or hang because the broker is unreachable,
// and the event can never be lost between the write succeeding and the
// message actually being published - outboxPublisher.ts owns that part,
// asynchronously, for as long as it takes.
async function recordOutboxEvent(
  session: mongoose.ClientSession,
  eventType: AppointmentEventType,
  appointment: IAppointment,
  doctorUserId: string,
): Promise<void> {
  const payload = buildAppointmentEvent(eventType, appointment, doctorUserId);
  await OutboxEvent.create([{ eventType, payload }], { session });
}

export async function createAppointment(
  patientId: string,
  input: CreateAppointmentInput,
): Promise<IAppointment> {
  const doctor = await Doctor.findById(input.doctorId);
  if (!doctor) {
    throw new ApiError(404, 'Doktor bulunamadı');
  }

  const conflict = await Appointment.findOne({
    doctorId: doctor._id,
    date: input.date,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (conflict) {
    throw new ApiError(409, 'Doktorun bu tarih ve saatte zaten bir randevusu var');
  }

  const session = await mongoose.startSession();
  try {
    let appointment!: IAppointment;
    await session.withTransaction(async () => {
      const created = await Appointment.create(
        [{ patientId, doctorId: doctor._id, date: input.date, status: 'pending' }],
        { session },
      );
      const [first] = created;
      if (!first) throw new Error('Appointment.create returned no document');
      appointment = first;
      await recordOutboxEvent(session, 'appointment.created', appointment, doctor.userId.toString());
    });
    return appointment;
  } finally {
    await session.endSession();
  }
}

export async function listMyAppointments(userId: string, role: Role): Promise<IAppointment[]> {
  if (role === 'doctor') {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) return [];
    return Appointment.find({ doctorId: doctor._id }).sort({ date: -1 });
  }

  return Appointment.find({ patientId: userId }).sort({ date: -1 });
}

export async function cancelAppointment(
  userId: string,
  appointmentId: string,
): Promise<IAppointment> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new ApiError(404, 'Randevu bulunamadı');
  }

  if (appointment.patientId.toString() !== userId) {
    throw new ApiError(403, 'Sadece kendi randevularınızı iptal edebilirsiniz');
  }

  if (appointment.status === 'cancelled') {
    throw new ApiError(400, 'Randevu zaten iptal edilmiş');
  }
  if (appointment.status === 'completed') {
    throw new ApiError(400, 'Tamamlanmış randevular iptal edilemez');
  }

  const doctor = await Doctor.findById(appointment.doctorId);
  if (!doctor) {
    throw new ApiError(404, 'Doktor bulunamadı');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      appointment.status = 'cancelled';
      await appointment.save({ session });
      await recordOutboxEvent(session, 'appointment.cancelled', appointment, doctor.userId.toString());
    });
    return appointment;
  } finally {
    await session.endSession();
  }
}

export async function confirmAppointment(
  userId: string,
  appointmentId: string,
): Promise<IAppointment> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new ApiError(404, 'Randevu bulunamadı');
  }

  const doctor = await Doctor.findOne({ userId });
  if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
    throw new ApiError(403, 'Sadece kendi randevularınızı onaylayabilirsiniz');
  }

  if (appointment.status !== 'pending') {
    throw new ApiError(400, 'Sadece onay bekleyen randevular onaylanabilir');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      appointment.status = 'confirmed';
      await appointment.save({ session });
      await recordOutboxEvent(session, 'appointment.confirmed', appointment, doctor.userId.toString());
    });
    return appointment;
  } finally {
    await session.endSession();
  }
}

export async function getAppointmentStats(): Promise<AppointmentStats> {
  // Bucketed in UTC throughout (to match $dateToString's default timezone),
  // regardless of the host machine's own local timezone.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (STATS_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [statusAgg, dailyAgg, totalAppointments, totalDoctors] = await Promise.all([
    Appointment.aggregate<{ _id: AppointmentStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.countDocuments(),
    Doctor.countDocuments(),
  ]);

  const byStatus = Object.fromEntries(APPOINTMENT_STATUSES.map((status) => [status, 0])) as Record<
    AppointmentStatus,
    number
  >;
  for (const row of statusAgg) byStatus[row._id] = row.count;

  const countsByDate = new Map(dailyAgg.map((row) => [row._id, row.count]));
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 0; i < STATS_DAYS; i += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    dailyCounts.push({ date: key, count: countsByDate.get(key) ?? 0 });
  }

  return { totalAppointments, totalDoctors, byStatus, dailyCounts };
}
