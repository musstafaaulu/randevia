import type { INotification } from '../models/Notification.model';
import logger from '../utils/logger';

// Delivery is simulated for now: a structured log line stands in for the
// e-mail. Swap this out for a real provider without touching the consumer.
export async function sendNotification(notification: INotification): Promise<void> {
  logger.info('Notification delivered (simulated)', {
    channel: notification.channel,
    notificationId: notification._id.toString(),
    recipientId: notification.recipientId.toString(),
    recipientRole: notification.recipientRole,
    type: notification.type,
    eventId: notification.eventId,
    appointmentId: notification.appointmentId.toString(),
    title: notification.title,
    message: notification.message,
  });
}
