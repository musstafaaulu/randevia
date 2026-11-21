import { z } from 'zod';
import { zObjectId } from '../utils/objectId';

export const upsertDoctorProfileSchema = z.object({
  name: z.string().trim().min(2, 'Ad en az 2 karakter olmalı').max(100),
  specialty: z.string().trim().min(2, 'Uzmanlık alanı en az 2 karakter olmalı').max(100),
  bio: z.string().trim().max(1000).optional(),
});

export const addAvailabilitySchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Bitiş saati başlangıç saatinden sonra olmalı',
    path: ['endTime'],
  });

export const doctorIdParamSchema = z.object({
  id: zObjectId,
});

export const availabilityIdParamSchema = z.object({
  id: zObjectId,
});

export type UpsertDoctorProfileInput = z.infer<typeof upsertDoctorProfileSchema>;
export type AddAvailabilityInput = z.infer<typeof addAvailabilitySchema>;
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;
export type AvailabilityIdParam = z.infer<typeof availabilityIdParamSchema>;
