import { Router } from 'express';
import {
  cancelAppointmentHandler,
  confirmAppointmentHandler,
  createAppointmentHandler,
  getStatsHandler,
  listMyAppointmentsHandler,
} from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
} from '../validations/appointment.validation';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('patient'),
  validate({ body: createAppointmentSchema }),
  createAppointmentHandler,
);
router.get('/me', authenticate, authorize('patient', 'doctor'), listMyAppointmentsHandler);
router.get('/stats', authenticate, authorize('admin'), getStatsHandler);
router.patch(
  '/:id/cancel',
  authenticate,
  authorize('patient'),
  validate({ params: appointmentIdParamSchema }),
  cancelAppointmentHandler,
);
router.patch(
  '/:id/confirm',
  authenticate,
  authorize('doctor'),
  validate({ params: appointmentIdParamSchema }),
  confirmAppointmentHandler,
);

export default router;
