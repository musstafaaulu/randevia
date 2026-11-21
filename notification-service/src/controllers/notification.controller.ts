import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import type {
  ListNotificationsQuery,
  NotificationIdParam,
} from '../validations/notification.validation';

export async function listMyNotificationsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const result = await notificationService.listNotificationsForUser(
    userId,
    req.query as unknown as ListNotificationsQuery,
  );
  res.status(200).json({ success: true, data: result });
}

export async function markNotificationAsReadHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params as unknown as NotificationIdParam;
  const notification = await notificationService.markNotificationAsRead(userId, id);
  res.status(200).json({ success: true, data: { notification } });
}

export async function markAllNotificationsAsReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.user!.id;
  const result = await notificationService.markAllNotificationsAsRead(userId);
  res.status(200).json({ success: true, data: result });
}
