import { Router } from 'express';
import { isEventConsumerConnected } from '../messaging/eventConsumer';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'notification-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    dependencies: {
      rabbitmq: isEventConsumerConnected() ? 'connected' : 'disconnected',
    },
  });
});

export default router;
