import { Router } from 'express';
import appointmentRoutes from './appointment.routes';
import doctorRoutes from './doctor.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
