import {
  isBookableAppointmentSlot,
  isBookableAvailabilityWindow,
  isWeekday,
  isWithinBookableWindow,
  MAX_BOOKING_DAYS,
} from '../../src/utils/businessHours';

// Turkey has used a fixed UTC+03:00 offset (no DST) since 2016, so Istanbul
// wall-clock times below are always UTC time minus 3 hours. 2026-11-23 is a
// Monday, 2026-11-21 a Saturday, 2026-11-20 a Friday - fixed reference dates
// so these tests don't depend on when they happen to run.
const MONDAY_09_00 = new Date('2026-11-23T06:00:00.000Z');
const MONDAY_11_30 = new Date('2026-11-23T08:30:00.000Z');
const MONDAY_12_00 = new Date('2026-11-23T09:00:00.000Z');
const MONDAY_12_30 = new Date('2026-11-23T09:30:00.000Z');
const MONDAY_13_00 = new Date('2026-11-23T10:00:00.000Z');
const MONDAY_16_30 = new Date('2026-11-23T13:30:00.000Z');
const MONDAY_16_45 = new Date('2026-11-23T13:45:00.000Z');
const MONDAY_17_00 = new Date('2026-11-23T14:00:00.000Z');
const MONDAY_08_30 = new Date('2026-11-23T05:30:00.000Z');
const SATURDAY_10_00 = new Date('2026-11-21T07:00:00.000Z');
const SUNDAY_10_00 = new Date('2026-11-22T07:00:00.000Z');
const FRIDAY_09_00 = new Date('2026-11-20T06:00:00.000Z');

describe('isWeekday', () => {
  it('is true Monday-Friday and false on the weekend, in Istanbul time', () => {
    expect(isWeekday(MONDAY_09_00)).toBe(true);
    expect(isWeekday(FRIDAY_09_00)).toBe(true);
    expect(isWeekday(SATURDAY_10_00)).toBe(false);
    expect(isWeekday(SUNDAY_10_00)).toBe(false);
  });
});

describe('isBookableAppointmentSlot', () => {
  it('accepts a slot at the start of the business day', () => {
    expect(isBookableAppointmentSlot(MONDAY_09_00)).toBe(true);
  });

  it('accepts the last slot that still ends by 17:00', () => {
    expect(isBookableAppointmentSlot(MONDAY_16_30)).toBe(true);
  });

  it('rejects a slot that would end after 17:00', () => {
    expect(isBookableAppointmentSlot(MONDAY_16_45)).toBe(false);
  });

  it('rejects a slot starting exactly at 17:00', () => {
    expect(isBookableAppointmentSlot(MONDAY_17_00)).toBe(false);
  });

  it('rejects a slot before 09:00', () => {
    expect(isBookableAppointmentSlot(MONDAY_08_30)).toBe(false);
  });

  it('accepts the slot that ends exactly as lunch starts', () => {
    expect(isBookableAppointmentSlot(MONDAY_11_30)).toBe(true);
  });

  it('rejects a slot starting at noon', () => {
    expect(isBookableAppointmentSlot(MONDAY_12_00)).toBe(false);
  });

  it('rejects a slot starting mid-lunch', () => {
    expect(isBookableAppointmentSlot(MONDAY_12_30)).toBe(false);
  });

  it('accepts the slot right after lunch ends', () => {
    expect(isBookableAppointmentSlot(MONDAY_13_00)).toBe(true);
  });

  it('rejects Saturday and Sunday entirely', () => {
    expect(isBookableAppointmentSlot(SATURDAY_10_00)).toBe(false);
    expect(isBookableAppointmentSlot(SUNDAY_10_00)).toBe(false);
  });
});

describe('isBookableAvailabilityWindow', () => {
  it('accepts a full morning window', () => {
    expect(isBookableAvailabilityWindow(MONDAY_09_00, MONDAY_12_00)).toBe(true);
  });

  it('accepts a full afternoon window ending exactly at 17:00', () => {
    expect(isBookableAvailabilityWindow(MONDAY_13_00, MONDAY_17_00)).toBe(true);
  });

  it('rejects a window that straddles the lunch break', () => {
    expect(isBookableAvailabilityWindow(MONDAY_09_00, MONDAY_13_00)).toBe(false);
  });

  it('rejects a window starting before 09:00', () => {
    expect(isBookableAvailabilityWindow(MONDAY_08_30, MONDAY_12_00)).toBe(false);
  });

  it('rejects a window ending after 17:00', () => {
    expect(isBookableAvailabilityWindow(MONDAY_16_30, new Date('2026-11-23T15:00:00.000Z'))).toBe(false);
  });

  it('rejects a window on a Saturday', () => {
    expect(
      isBookableAvailabilityWindow(SATURDAY_10_00, new Date(SATURDAY_10_00.getTime() + 60 * 60 * 1000)),
    ).toBe(false);
  });

  it('rejects a window spanning more than one calendar day', () => {
    const start = MONDAY_09_00;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    expect(isBookableAvailabilityWindow(start, end)).toBe(false);
  });
});

describe('isWithinBookableWindow', () => {
  const now = new Date('2026-11-20T06:00:00.000Z');

  it('accepts a date exactly MAX_BOOKING_DAYS away', () => {
    const date = new Date(now.getTime() + MAX_BOOKING_DAYS * 24 * 60 * 60 * 1000);
    expect(isWithinBookableWindow(date, now)).toBe(true);
  });

  it('rejects a date one day beyond MAX_BOOKING_DAYS', () => {
    const date = new Date(now.getTime() + (MAX_BOOKING_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isWithinBookableWindow(date, now)).toBe(false);
  });
});
