import { Types } from 'mongoose';
import type { AppointmentEvent } from '../events/appointment.events';
import { INotification, Notification } from '../models/Notification.model';
import { emitToDoctorWatchers, emitToUser } from '../realtime/notifier';
import type { ListNotificationsQuery } from '../validations/notification.validation';
import { ApiError } from '../utils/ApiError';
import { sendNotification } from './notificationSender';
import { buildNotificationDrafts } from './notificationTemplates';

export interface ProcessResult {
  delivered: number;
}

export function countUnread(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, read: false });
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

    const recipientId = notification.recipientId.toString();
    const unreadCount = await countUnread(recipientId);
    emitToUser(recipientId, 'notification', { notification, unreadCount });
  }

  // One broadcast per event, independent of how many notifications it
  // produced, so anyone watching this doctor's page (patient or doctor,
  // whether or not they are a recipient) sees availability change live.
  emitToDoctorWatchers(event.doctorId, 'slot.updated', {
    doctorId: event.doctorId,
    appointmentId: event.appointmentId,
    date: event.date,
    status: event.status,
    eventType: event.eventType,
  });

  return { delivered: pending.length };
}

export interface NotificationPage {
  notifications: INotification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listNotificationsForUser(
  userId: string,
  { page, limit }: ListNotificationsQuery,
): Promise<NotificationPage> {
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ recipientId: userId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ recipientId: userId }),
    countUnread(userId),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<INotification> {
  const notification = await Notification.findOne({ _id: notificationId, recipientId: userId });
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }

  return notification;
}

export async function markAllNotificationsAsRead(userId: string): Promise<{ modified: number }> {
  const result = await Notification.updateMany(
    { recipientId: userId, read: false },
    { $set: { read: true } },
  );
  return { modified: result.modifiedCount };
}
