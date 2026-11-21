import type { INotification } from '../models/Notification.model';
import { getUserEmail } from './internalAuthClient';
import { sendMail } from '../utils/mailer';
import logger from '../utils/logger';

// Throws on any failure (unknown recipient, auth-service unreachable, SMTP
// down): processAppointmentEvent lets that propagate, which leaves this
// notification 'pending' for RabbitMQ to redeliver - the same resilience the
// rest of the event pipeline already relies on, not a separate retry path.
export async function sendNotification(notification: INotification): Promise<void> {
  const email = await getUserEmail(notification.recipientId.toString());
  await sendMail({
    to: email,
    subject: notification.title,
    html: `<p>${notification.message}</p>`,
  });
  logger.info('Notification e-mail sent', {
    notificationId: notification._id.toString(),
    recipientId: notification.recipientId.toString(),
    recipientRole: notification.recipientRole,
    type: notification.type,
    eventId: notification.eventId,
  });
}
