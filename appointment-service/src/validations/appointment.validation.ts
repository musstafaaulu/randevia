import { z } from 'zod';
import { zObjectId } from '../utils/objectId';

export const createAppointmentSchema = z.object({
  doctorId: zObjectId,
  date: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: 'Randevu tarihi ileride bir zaman olmalı',
  }),
});

export const appointmentIdParamSchema = z.object({
  id: zObjectId,
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type AppointmentIdParam = z.infer<typeof appointmentIdParamSchema>;
