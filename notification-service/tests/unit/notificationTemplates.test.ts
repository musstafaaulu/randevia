import { APPOINTMENT_EVENT_TYPES } from '../../src/events/appointment.events';
import {
  buildNotificationDrafts,
  formatAppointmentDate,
} from '../../src/services/notificationTemplates';
import { makeEvent } from '../utils/events';

describe('buildNotificationDrafts', () => {
  it.each(APPOINTMENT_EVENT_TYPES)('addresses the patient and the doctor user for %s', (type) => {
    const event = makeEvent({ eventType: type });

    const drafts = buildNotificationDrafts(event);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ recipientId: event.patientId, recipientRole: 'patient' });
    // The doctor is addressed by auth user id, not by the doctor profile id.
    expect(drafts[1]).toMatchObject({ recipientId: event.doctorUserId, recipientRole: 'doctor' });
    for (const draft of drafts) {
      expect(draft.title).toBeTruthy();
      expect(draft.message).toContain(formatAppointmentDate(event.date));
    }
  });

  it('formats the appointment date in the configured timezone', () => {
    // 07:30 UTC is 10:30 in Europe/Istanbul (UTC+3).
    expect(formatAppointmentDate('2030-05-20T07:30:00.000Z')).toBe('20 Mayıs 2030, 10:30');
  });
});
