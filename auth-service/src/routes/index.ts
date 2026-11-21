import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import internalRoutes from './internal.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth/internal', internalRoutes);
router.use('/auth/users', userRoutes);
router.use('/auth', authRoutes);

export default router;
