import { Router } from 'express';
import {
  addAvailabilityHandler,
  getDoctorHandler,
  listDoctorsHandler,
  upsertDoctorProfileHandler,
} from '../controllers/doctor.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  addAvailabilitySchema,
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
router.get('/:id', authenticate, validate({ params: doctorIdParamSchema }), getDoctorHandler);

export default router;
