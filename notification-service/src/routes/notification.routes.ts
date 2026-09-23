import { Router } from 'express';
import { listMyNotificationsHandler } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { listNotificationsQuerySchema } from '../validations/notification.validation';

const router = Router();

router.get(
  '/me',
  authenticate,
  validate({ query: listNotificationsQuerySchema }),
  listMyNotificationsHandler,
);

export default router;
