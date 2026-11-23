import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createAppointment } from '../api/appointments';
import { ApiError } from '../api/client';
import { getDoctor } from '../api/doctors';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useSocket } from '../socket/SocketContext';
import { avatarColor } from '../utils/avatarColor';
import {
  addDays,
  buildGridMinutes,
  formatMinutes,
  isLunchMinute,
  isBusinessMinute,
  isWeekend,
  MAX_BOOKING_DAYS,
  minutesOfDay,
  SLOT_MINUTES,
  startOfDay,
} from '../utils/businessHours';
import type { Availability, Doctor, SlotUpdatedPayload } from '../types/api';

const WEEK_DAYS = 7;
const GRID_MINUTES = buildGridMinutes();
const MAX_WEEK_OFFSET = Math.floor(MAX_BOOKING_DAYS / WEEK_DAYS);

interface Slot {
  start: Date;
  booked: boolean;
}

function buildSlotMap(availability: Availability[], bookedSlots: string[]): Map<string, Slot> {
  const bookedTimes = new Set(bookedSlots.map((iso) => new Date(iso).getTime()));
  const map = new Map<string, Slot>();

  for (const range of availability) {
    const end = new Date(range.endTime).getTime();
    let cursor = new Date(range.startTime).getTime();
    while (cursor + SLOT_MINUTES * 60_000 <= end) {
      const start = new Date(cursor);
      map.set(cellKey(start), { start, booked: bookedTimes.has(cursor) });
      cursor += SLOT_MINUTES * 60_000;
    }
  }

  return map;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cellKey(date: Date): string {
  return `${dayKey(date)}-${minutesOfDay(date)}`;
}

function formatDayHeader(date: Date): { weekday: string; dayMonth: string } {
  return {
    weekday: date.toLocaleDateString('tr-TR', { weekday: 'long' }),
    dayMonth: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
  };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

interface DayColumn {
  date: Date;
  dayIndex: number;
  inRange: boolean;
  weekend: boolean;
}

function buildWeekColumns(weekOffset: number, today: Date): DayColumn[] {
  const columns: DayColumn[] = [];
  for (let i = 0; i < WEEK_DAYS; i += 1) {
    const dayIndex = weekOffset * WEEK_DAYS + i;
    const date = addDays(today, dayIndex);
    columns.push({ date, dayIndex, inRange: dayIndex <= MAX_BOOKING_DAYS, weekend: isWeekend(date) });
  }
  return columns;
}

type CellKind = 'closed' | 'out-of-range' | 'unavailable' | 'past' | 'booked' | 'free';

function classifyCell(column: DayColumn, minutes: number, now: number, slotMap: Map<string, Slot>) {
  if (!column.inRange) return { kind: 'out-of-range' as CellKind, slot: undefined };
  if (column.weekend || isLunchMinute(minutes) || !isBusinessMinute(minutes)) {
    return { kind: 'closed' as CellKind, slot: undefined };
  }
  const key = `${dayKey(column.date)}-${minutes}`;
  const slot = slotMap.get(key);
  if (!slot) return { kind: 'unavailable' as CellKind, slot: undefined };
  if (slot.start.getTime() <= now) return { kind: 'past' as CellKind, slot: undefined };
  if (slot.booked) return { kind: 'booked' as CellKind, slot };
  return { kind: 'free' as CellKind, slot };
}

export function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const socket = useSocket();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slotMap, setSlotMap] = useState<Map<string, Slot>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookingKey, setBookingKey] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    getDoctor(id)
      .then((res) => {
        setDoctor(res.doctor);
        setSlotMap(buildSlotMap(res.availability, res.bookedSlots));
      })
      .catch(() => setError('Doktor bilgileri yüklenemedi.'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Anyone looking at this page - patient or doctor - sees availability
  // change the instant someone else books or cancels, no refresh needed.
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('doctor:watch', id);
    function onSlotUpdated(payload: SlotUpdatedPayload) {
      if (payload.doctorId === id) load();
    }
    socket.on('slot.updated', onSlotUpdated);

    return () => {
      socket.off('slot.updated', onSlotUpdated);
      socket.emit('doctor:unwatch', id);
    };
  }, [socket, id, load]);

  const columns = useMemo(() => buildWeekColumns(weekOffset, startOfDay(new Date())), [weekOffset]);
  const hasAnyAvailability = slotMap.size > 0;

  async function handleBook(slot: Slot) {
    if (!doctor) return;
    setNotice(null);
    setBookingKey(slot.start.getTime());
    try {
      await createAppointment({ doctorId: doctor._id, date: slot.start.toISOString() });
      setNotice('Randevu talebiniz alındı. Doktorun onayını bekliyor.');
      load();
    } catch (err) {
      setNotice(
        err instanceof ApiError ? err.message : 'Randevu oluşturulamadı, lütfen tekrar deneyin.',
      );
      load();
    } finally {
      setBookingKey(null);
    }
  }

  if (error) return <div className="page-error">{error}</div>;
  if (!doctor) return <Spinner label="Doktor bilgileri yükleniyor…" />;

  const canBook = user?.role === 'patient';
  const now = Date.now();
  const rangeStart = formatDayHeader(columns[0].date);
  const rangeEnd = formatDayHeader(columns[columns.length - 1].date);

  return (
    <div className="page">
      <div className="doctor-header">
        <div
          className="doctor-avatar doctor-avatar-lg"
          style={{ background: avatarColor(doctor.name) }}
          aria-hidden="true"
        >
          {doctor.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1>{doctor.name}</h1>
          <span className="specialty-tag">{doctor.specialty}</span>
          {doctor.bio && <p className="doctor-bio">{doctor.bio}</p>}
        </div>
      </div>

      {notice && <div className="form-notice">{notice}</div>}

      <h2 className="section-title">Müsait Saatler</h2>

      {!hasAnyAvailability ? (
        <EmptyState icon="🗓️" text="Bu doktor için yaklaşan müsaitlik bulunmuyor." />
      ) : (
        <>
          <div className="week-nav">
            <button
              type="button"
              className="secondary-button"
              disabled={weekOffset === 0}
              onClick={() => setWeekOffset((value) => value - 1)}
            >
              ‹ Önceki Hafta
            </button>
            <span className="week-nav-range">
              {rangeStart.dayMonth} – {rangeEnd.dayMonth}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={weekOffset >= MAX_WEEK_OFFSET}
              onClick={() => setWeekOffset((value) => value + 1)}
            >
              Sonraki Hafta ›
            </button>
          </div>

          <div className="week-grid-scroll">
            <div className="week-grid" style={{ gridTemplateColumns: `60px repeat(${WEEK_DAYS}, 1fr)` }}>
              <div className="week-grid-corner" aria-hidden="true" />
              {columns.map((column) => {
                const { weekday, dayMonth } = formatDayHeader(column.date);
                return (
                  <div
                    key={column.dayIndex}
                    className={column.weekend ? 'week-grid-header week-grid-header-closed' : 'week-grid-header'}
                  >
                    <strong>{weekday}</strong>
                    <span>{dayMonth}</span>
                  </div>
                );
              })}

              {GRID_MINUTES.map((minutes) => (
                <Fragment key={minutes}>
                  <div className="week-grid-time">
                    {formatMinutes(minutes)}
                  </div>
                  {columns.map((column) => {
                    const { kind, slot } = classifyCell(column, minutes, now, slotMap);
                    const cellTestKey = `${column.dayIndex}-${minutes}`;

                    if (kind === 'free' && slot) {
                      if (!canBook) {
                        return (
                          <div
                            key={cellTestKey}
                            className="grid-cell grid-cell-free"
                            title={`${formatTime(slot.start)} müsait`}
                          />
                        );
                      }
                      const isBooking = bookingKey === slot.start.getTime();
                      return (
                        <button
                          key={cellTestKey}
                          type="button"
                          className="grid-cell grid-cell-free grid-cell-button"
                          disabled={isBooking}
                          onClick={() => handleBook(slot)}
                          aria-label={`${formatTime(slot.start)} için randevu al`}
                        >
                          {isBooking ? '…' : ''}
                        </button>
                      );
                    }

                    if (kind === 'booked') {
                      return (
                        <div
                          key={cellTestKey}
                          className="grid-cell grid-cell-booked"
                          title={`${formatTime(slot!.start)} dolu`}
                        />
                      );
                    }

                    return (
                      <div
                        key={cellTestKey}
                        className={`grid-cell grid-cell-closed grid-cell-${kind}`}
                        aria-hidden="true"
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="week-grid-legend">
            <span>
              <i className="legend-dot legend-dot-free" /> Müsait
            </span>
            <span>
              <i className="legend-dot legend-dot-booked" /> Dolu
            </span>
            <span>
              <i className="legend-dot legend-dot-unavailable" /> Planlanmamış
            </span>
            <span>
              <i className="legend-dot legend-dot-closed" /> Kapalı (hafta sonu / öğle molası / mesai dışı)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
