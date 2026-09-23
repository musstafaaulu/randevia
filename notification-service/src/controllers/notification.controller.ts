import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import type { ListNotificationsQuery } from '../validations/notification.validation';

export async function listMyNotificationsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const result = await notificationService.listNotificationsForUser(
    userId,
    req.query as unknown as ListNotificationsQuery,
  );
  res.status(200).json({ success: true, data: result });
}
