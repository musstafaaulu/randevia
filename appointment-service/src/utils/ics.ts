// A minimal RFC 5545 VEVENT - just enough for "add this appointment to your
// calendar" to work in Google/Apple/Outlook calendars, without pulling in a
// dependency for a handful of lines.
export interface IcsEventInput {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export function buildIcsEvent(input: IcsEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Randevia//Appointment//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(input.start)}`,
    `DTEND:${formatIcsDate(input.end)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    ...(input.description ? [`DESCRIPTION:${escapeIcsText(input.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
