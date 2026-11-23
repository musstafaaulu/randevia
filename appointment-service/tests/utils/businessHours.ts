// Test-fixture builders for dates that are guaranteed to satisfy (or, for
// weekendDate, guaranteed to violate) the business-hours rules in
// src/utils/businessHours.ts. Turkey has used a fixed UTC+03:00 offset (no
// DST) since 2016, so Istanbul wall-clock time is always UTC time plus 3
// hours - no timezone database needed here.
const TZ_OFFSET_HOURS = 3;

function istanbulWeekdayOf(date: Date): number {
  return new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000).getUTCDay();
}

function nextWeekday(daysAhead: number): Date {
  let candidate = new Date();
  let remaining = daysAhead;
  while (remaining > 0) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    const weekday = istanbulWeekdayOf(candidate);
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return candidate;
}

function atIstanbulTime(date: Date, hour: number, minute: number): Date {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const utcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    hour - TZ_OFFSET_HOURS,
    minute,
  );
  return new Date(utcMs);
}

// An ISO datetime `daysAhead` weekdays from now (weekends don't count),
// snapped to a safe mid-morning Istanbul time by default - always inside
// business hours, outside the lunch break, and well within the 14-day
// booking window.
export function bookableDate(daysAhead = 1, hour = 10, minute = 0): string {
  return atIstanbulTime(nextWeekday(daysAhead), hour, minute).toISOString();
}

// A {startTime, endTime} availability window on the same future weekday.
export function bookableWindow(
  daysAhead = 1,
  startHour = 9,
  startMinute = 0,
  endHour = 12,
  endMinute = 0,
): { startTime: string; endTime: string } {
  const day = nextWeekday(daysAhead);
  return {
    startTime: atIstanbulTime(day, startHour, startMinute).toISOString(),
    endTime: atIstanbulTime(day, endHour, endMinute).toISOString(),
  };
}

// A Saturday, for tests that need a date the business-hours rules must
// reject.
export function weekendDate(hour = 10, minute = 0): string {
  let candidate = new Date();
  for (let i = 0; i < 14; i += 1) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    if (istanbulWeekdayOf(candidate) === 6) {
      return atIstanbulTime(candidate, hour, minute).toISOString();
    }
  }
  throw new Error('no Saturday found in the next 14 days');
}
