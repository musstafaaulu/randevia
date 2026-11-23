import { z } from 'zod';
import { isBookableAppointmentSlot, isWithinBookableWindow } from '../utils/businessHours';
import { zObjectId } from '../utils/objectId';

export const createAppointmentSchema = z.object({
  doctorId: zObjectId,
  date: z.coerce
    .date()
    .refine((value) => value.getTime() > Date.now(), {
      message: 'Randevu tarihi ileride bir zaman olmalı',
    })
    .refine((value) => isWithinBookableWindow(value), {
      message: 'Randevular yalnızca bugünden itibaren en fazla 14 gün sonrasına alınabilir',
    })
    .refine((value) => isBookableAppointmentSlot(value), {
      message:
        'Randevular yalnızca hafta içi (Pazartesi-Cuma) 09:00-17:00 arasında, 12:00-13:00 öğle molası hariç alınabilir',
    }),
});

export const appointmentIdParamSchema = z.object({
  id: zObjectId,
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type AppointmentIdParam = z.infer<typeof appointmentIdParamSchema>;
