import { Request, Response } from 'express';
import * as appointmentService from '../services/appointment.service';
import type {
  AppointmentIdParam,
  CreateAppointmentInput,
} from '../validations/appointment.validation';

export async function createAppointmentHandler(req: Request, res: Response): Promise<void> {
  const patientId = req.user!.id;
  const appointment = await appointmentService.createAppointment(
    patientId,
    req.body as CreateAppointmentInput,
  );
  res.status(201).json({ success: true, message: 'Randevu talep edildi', data: { appointment } });
}

export async function listMyAppointmentsHandler(req: Request, res: Response): Promise<void> {
  const { id, role } = req.user!;
  const appointments = await appointmentService.listMyAppointments(id, role);
  res.status(200).json({ success: true, data: { appointments } });
}

export async function cancelAppointmentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params as unknown as AppointmentIdParam;
  const appointment = await appointmentService.cancelAppointment(userId, id);
  res.status(200).json({ success: true, message: 'Randevu iptal edildi', data: { appointment } });
}

export async function confirmAppointmentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params as unknown as AppointmentIdParam;
  const appointment = await appointmentService.confirmAppointment(userId, id);
  res.status(200).json({ success: true, message: 'Randevu onaylandı', data: { appointment } });
}
