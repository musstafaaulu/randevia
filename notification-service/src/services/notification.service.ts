import { Types } from 'mongoose';
import type { AppointmentEvent } from '../events/appointment.events';
import { INotification, Notification } from '../models/Notification.model';
import type { ListNotificationsQuery } from '../validations/notification.validation';
import { sendNotification } from './notificationSender';
import { buildNotificationDrafts } from './notificationTemplates';

export interface ProcessResult {
  delivered: number;
}

// Safe to call more than once for the same event (at-least-once delivery):
// notifications are upserted by (eventId, recipientRole) and only those not
// yet sent are delivered, so a redelivery after a crash finishes the job
// without duplicating anything.
export async function processAppointmentEvent(event: AppointmentEvent): Promise<ProcessResult> {
  const drafts = buildNotificationDrafts(event);

  await Notification.bulkWrite(
    drafts.map((draft) => ({
      updateOne: {
        filter: { eventId: event.eventId, recipientRole: draft.recipientRole },
        update: {
          $setOnInsert: {
            ...draft,
            recipientId: new Types.ObjectId(draft.recipientId),
            channel: 'email',
            type: event.eventType,
            eventId: event.eventId,
            appointmentId: new Types.ObjectId(event.appointmentId),
            appointmentDate: new Date(event.date),
            status: 'pending',
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  const pending = await Notification.find({ eventId: event.eventId, status: 'pending' });
  for (const notification of pending) {
    await sendNotification(notification);
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();
  }

  return { delivered: pending.length };
}

export interface NotificationPage {
  notifications: INotification[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listNotificationsForUser(
  userId: string,
  { page, limit }: ListNotificationsQuery,
): Promise<NotificationPage> {
  const [notifications, total] = await Promise.all([
    Notification.find({ recipientId: userId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ recipientId: userId }),
  ]);

  return {
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
