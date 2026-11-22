import { buildIcsEvent } from '../../src/utils/ics';

describe('buildIcsEvent', () => {
  it('produces a minimal valid VEVENT', () => {
    const ics = buildIcsEvent({
      uid: 'test-uid@randevia.local',
      start: new Date('2030-05-20T07:30:00.000Z'),
      end: new Date('2030-05-20T08:00:00.000Z'),
      summary: 'Randevia - Dr. Test (Cardiology)',
      description: 'Randevu durumu: confirmed',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:test-uid@randevia.local');
    expect(ics).toContain('DTSTART:20300520T073000Z');
    expect(ics).toContain('DTEND:20300520T080000Z');
    expect(ics).toContain('SUMMARY:Randevia - Dr. Test (Cardiology)');
    expect(ics).toContain('DESCRIPTION:Randevu durumu: confirmed');
    expect(ics).toMatch(/\r\n/); // CRLF line endings, as RFC 5545 requires
  });

  it('escapes commas, semicolons and backslashes in free text', () => {
    const ics = buildIcsEvent({
      uid: 'u',
      start: new Date(),
      end: new Date(),
      summary: 'A, B; C\\D',
    });

    expect(ics).toContain('SUMMARY:A\\, B\\; C\\\\D');
  });

  it('omits DESCRIPTION entirely when none is given', () => {
    const ics = buildIcsEvent({ uid: 'u', start: new Date(), end: new Date(), summary: 'S' });
    expect(ics).not.toContain('DESCRIPTION');
  });
});
