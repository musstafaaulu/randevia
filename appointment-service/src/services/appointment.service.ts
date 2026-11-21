import { AppointmentEventType, buildAppointmentEvent } from '../events/appointment.events';
import { publishEvent } from '../messaging/eventPublisher';
import { Appointment, IAppointment } from '../models/Appointment.model';
import { Doctor } from '../models/Doctor.model';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types/role';
import type { CreateAppointmentInput } from '../validations/appointment.validation';

// Fire-and-forget: the request must not wait for, or fail because of, the broker.
function emitAppointmentEvent(
  eventType: AppointmentEventType,
  appointment: IAppointment,
  doctorUserId: string,
): void {
  void publishEvent(buildAppointmentEvent(eventType, appointment, doctorUserId));
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

  const appointment = await Appointment.create({
    patientId,
    doctorId: doctor._id,
    date: input.date,
    status: 'pending',
  });

  emitAppointmentEvent('appointment.created', appointment, doctor.userId.toString());

  return appointment;
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

  appointment.status = 'cancelled';
  await appointment.save();

  emitAppointmentEvent('appointment.cancelled', appointment, doctor.userId.toString());

  return appointment;
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

  appointment.status = 'confirmed';
  await appointment.save();

  emitAppointmentEvent('appointment.confirmed', appointment, doctor.userId.toString());

  return appointment;
}
