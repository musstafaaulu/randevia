import { Request, Response } from 'express';
import * as doctorService from '../services/doctor.service';
import type {
  AddAvailabilityInput,
  DoctorIdParam,
  UpsertDoctorProfileInput,
} from '../validations/doctor.validation';

export async function listDoctorsHandler(_req: Request, res: Response): Promise<void> {
  const doctors = await doctorService.listDoctors();
  res.status(200).json({ success: true, data: { doctors } });
}

export async function getDoctorHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DoctorIdParam;
  const { doctor, availability, bookedSlots } = await doctorService.getDoctorById(id);
  res.status(200).json({ success: true, data: { doctor, availability, bookedSlots } });
}

export async function upsertDoctorProfileHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const doctor = await doctorService.upsertDoctorProfile(
    userId,
    req.body as UpsertDoctorProfileInput,
  );
  res.status(200).json({ success: true, message: 'Doctor profile saved', data: { doctor } });
}

export async function addAvailabilityHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const availability = await doctorService.addAvailability(
    userId,
    req.body as AddAvailabilityInput,
  );
  res.status(201).json({ success: true, message: 'Availability added', data: { availability } });
}
