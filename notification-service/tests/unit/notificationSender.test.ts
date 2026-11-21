import { Types } from 'mongoose';
import type { INotification } from '../../src/models/Notification.model';
import * as internalAuthClient from '../../src/services/internalAuthClient';
import { sendNotification } from '../../src/services/notificationSender';
import * as mailer from '../../src/utils/mailer';

function notification(overrides: Partial<INotification> = {}): INotification {
  return {
    _id: new Types.ObjectId(),
    recipientId: new Types.ObjectId(),
    recipientRole: 'patient',
    channel: 'email',
    type: 'appointment.created',
    title: 'Randevu talebiniz alındı',
    message: '20 Mayıs 2030, 10:30 tarihli randevu talebiniz alındı.',
    eventId: 'evt-1',
    appointmentId: new Types.ObjectId(),
    appointmentDate: new Date(),
    status: 'pending',
    read: false,
    ...overrides,
  } as INotification;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sendNotification', () => {
  it('looks up the recipient e-mail and sends mail with the notification title/message', async () => {
    jest.spyOn(internalAuthClient, 'getUserEmail').mockResolvedValue('patient@example.com');
    const sendMailSpy = jest.spyOn(mailer, 'sendMail').mockResolvedValue(undefined);
    const n = notification();

    await sendNotification(n);

    expect(internalAuthClient.getUserEmail).toHaveBeenCalledWith(n.recipientId.toString());
    expect(sendMailSpy).toHaveBeenCalledWith({
      to: 'patient@example.com',
      subject: n.title,
      html: `<p>${n.message}</p>`,
    });
  });

  it('propagates a failed e-mail lookup instead of swallowing it', async () => {
    jest.spyOn(internalAuthClient, 'getUserEmail').mockRejectedValue(new Error('auth-service down'));
    const sendMailSpy = jest.spyOn(mailer, 'sendMail');

    await expect(sendNotification(notification())).rejects.toThrow('auth-service down');
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it('propagates a failed mail send', async () => {
    jest.spyOn(internalAuthClient, 'getUserEmail').mockResolvedValue('patient@example.com');
    jest.spyOn(mailer, 'sendMail').mockRejectedValue(new Error('smtp down'));

    await expect(sendNotification(notification())).rejects.toThrow('smtp down');
  });
});
