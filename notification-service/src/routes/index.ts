import { Router } from 'express';
import healthRoutes from './health.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/notifications', notificationRoutes);

export default router;
