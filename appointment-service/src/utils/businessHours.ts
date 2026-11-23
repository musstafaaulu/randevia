// Randevia only operates Monday-Friday 09:00-17:00 Istanbul time, with a
// 12:00-13:00 lunch break closed to bookings, and only within the next 14
// days. Enforced here (not just in the web UI) because the web UI is not
// the only possible caller of this API.
const TIMEZONE = 'Europe/Istanbul';

export const BUSINESS_START_MINUTES = 9 * 60;
export const BUSINESS_END_MINUTES = 17 * 60;
export const LUNCH_START_MINUTES = 12 * 60;
export const LUNCH_END_MINUTES = 13 * 60;
export const MAX_BOOKING_DAYS = 14;
export const APPOINTMENT_DURATION_MINUTES = 30;

interface IstanbulParts {
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
  weekday: number;
  minutesOfDay: number;
  dateKey: string;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getIstanbulParts(date: Date): IstanbulParts {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  const hour = Number(map.hour) % 24; // hourCycle h23 can still emit "24" for midnight on some ICU builds
  return {
    weekday: WEEKDAY_INDEX[map.weekday ?? ''] ?? 0,
    minutesOfDay: hour * 60 + Number(map.minute),
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
}

export function isWeekday(date: Date): boolean {
  const { weekday } = getIstanbulParts(date);
  return weekday >= 1 && weekday <= 5;
}

export function isWithinBookableWindow(date: Date, now: Date = new Date()): boolean {
  const maxTime = now.getTime() + MAX_BOOKING_DAYS * 24 * 60 * 60 * 1000;
  return date.getTime() <= maxTime;
}

// A 30-minute appointment slot starting at `date` must land entirely on a
// weekday, inside 09:00-17:00, and not touch the 12:00-13:00 lunch break.
export function isBookableAppointmentSlot(date: Date): boolean {
  const { weekday, minutesOfDay } = getIstanbulParts(date);
  if (weekday < 1 || weekday > 5) return false;

  const slotEnd = minutesOfDay + APPOINTMENT_DURATION_MINUTES;
  if (minutesOfDay < BUSINESS_START_MINUTES || slotEnd > BUSINESS_END_MINUTES) return false;

  const overlapsLunch = minutesOfDay < LUNCH_END_MINUTES && slotEnd > LUNCH_START_MINUTES;
  return !overlapsLunch;
}

// A doctor's availability window [start, end) must stay within a single
// Istanbul calendar day, on a weekday, inside 09:00-17:00, and never
// straddle the lunch break.
export function isBookableAvailabilityWindow(start: Date, end: Date): boolean {
  const s = getIstanbulParts(start);
  const e = getIstanbulParts(end);
  if (s.dateKey !== e.dateKey) return false;
  if (s.weekday < 1 || s.weekday > 5) return false;
  if (s.minutesOfDay < BUSINESS_START_MINUTES) return false;
  if (e.minutesOfDay > BUSINESS_END_MINUTES) return false;

  const overlapsLunch = s.minutesOfDay < LUNCH_END_MINUTES && e.minutesOfDay > LUNCH_START_MINUTES;
  return !overlapsLunch;
}
