import { Router } from 'express';
import {
  addAvailabilityHandler,
  deleteAvailabilityHandler,
  getDoctorHandler,
  listDoctorsHandler,
  upsertDoctorProfileHandler,
} from '../controllers/doctor.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  addAvailabilitySchema,
  availabilityIdParamSchema,
  doctorIdParamSchema,
  upsertDoctorProfileSchema,
} from '../validations/doctor.validation';

const router = Router();

router.get('/', authenticate, listDoctorsHandler);
router.post(
  '/me',
  authenticate,
  authorize('doctor'),
  validate({ body: upsertDoctorProfileSchema }),
  upsertDoctorProfileHandler,
);
router.post(
  '/me/availability',
  authenticate,
  authorize('doctor'),
  validate({ body: addAvailabilitySchema }),
  addAvailabilityHandler,
);
router.delete(
  '/me/availability/:id',
  authenticate,
  authorize('doctor'),
  validate({ params: availabilityIdParamSchema }),
  deleteAvailabilityHandler,
);
router.get('/:id', authenticate, validate({ params: doctorIdParamSchema }), getDoctorHandler);

export default router;
