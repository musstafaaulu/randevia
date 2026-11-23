// Mirrors the rules the backend enforces (appointment-service/src/utils/businessHours.ts):
// weekdays only, 09:00-17:00, closed 12:00-13:00 for lunch, bookable only within
// the next MAX_BOOKING_DAYS days. This copy only drives what the calendar grid
// shows as closed/disabled - the backend is the real source of truth.
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 17;
export const LUNCH_START_HOUR = 12;
export const LUNCH_END_HOUR = 13;
export const MAX_BOOKING_DAYS = 14;
export const SLOT_MINUTES = 30;

// The grid shows an hour of padding on each side of business hours so
// "mesai dışı" (off-hours) rows are visible and visually closed, not just
// absent from the calendar.
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 18;

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isLunchMinute(minutes: number): boolean {
  return minutes >= LUNCH_START_HOUR * 60 && minutes < LUNCH_END_HOUR * 60;
}

export function isBusinessMinute(minutes: number): boolean {
  return minutes >= BUSINESS_START_HOUR * 60 && minutes < BUSINESS_END_HOUR * 60;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Every half-hour mark the grid displays, from GRID_START_HOUR to
// GRID_END_HOUR (exclusive).
export function buildGridMinutes(): number[] {
  const result: number[] = [];
  for (let minutes = GRID_START_HOUR * 60; minutes < GRID_END_HOUR * 60; minutes += SLOT_MINUTES) {
    result.push(minutes);
  }
  return result;
}
