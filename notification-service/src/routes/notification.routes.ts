import { Router } from 'express';
import {
  listMyNotificationsHandler,
  markAllNotificationsAsReadHandler,
  markNotificationAsReadHandler,
} from '../controllers/notification.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validations/notification.validation';

const router = Router();

router.get(
  '/me',
  authenticate,
  validate({ query: listNotificationsQuerySchema }),
  listMyNotificationsHandler,
);

router.patch('/read-all', authenticate, markAllNotificationsAsReadHandler);

router.patch(
  '/:id/read',
  authenticate,
  validate({ params: notificationIdParamSchema }),
  markNotificationAsReadHandler,
);

export default router;
