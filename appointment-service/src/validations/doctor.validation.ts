import { z } from 'zod';
import { zObjectId } from '../utils/objectId';

export const upsertDoctorProfileSchema = z.object({
  specialty: z.string().trim().min(2, 'Specialty must be at least 2 characters').max(100),
  bio: z.string().trim().max(1000).optional(),
});

export const addAvailabilitySchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const doctorIdParamSchema = z.object({
  id: zObjectId,
});

export type UpsertDoctorProfileInput = z.infer<typeof upsertDoctorProfileSchema>;
export type AddAvailabilityInput = z.infer<typeof addAvailabilitySchema>;
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;
