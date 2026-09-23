import { Router } from 'express';
import { isEventPublisherConnected } from '../messaging/eventPublisher';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'appointment-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    dependencies: {
      rabbitmq: isEventPublisherConnected() ? 'connected' : 'disconnected',
    },
  });
});

export default router;
