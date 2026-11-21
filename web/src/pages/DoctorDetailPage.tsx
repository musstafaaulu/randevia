import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createAppointment } from '../api/appointments';
import { ApiError } from '../api/client';
import { getDoctor } from '../api/doctors';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useSocket } from '../socket/SocketContext';
import { avatarColor } from '../utils/avatarColor';
import type { Availability, Doctor, SlotUpdatedPayload } from '../types/api';

const SLOT_MINUTES = 30;

interface Slot {
  start: Date;
  booked: boolean;
}

function buildSlots(availability: Availability[], bookedSlots: string[]): Slot[] {
  const bookedTimes = new Set(bookedSlots.map((iso) => new Date(iso).getTime()));
  const slots: Slot[] = [];

  for (const range of availability) {
    const end = new Date(range.endTime).getTime();
    let cursor = new Date(range.startTime).getTime();
    while (cursor + SLOT_MINUTES * 60_000 <= end) {
      slots.push({ start: new Date(cursor), booked: bookedTimes.has(cursor) });
      cursor += SLOT_MINUTES * 60_000;
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  key: string;
  date: Date;
  slots: Slot[];
}

function groupByDay(slots: Slot[]): DayColumn[] {
  const columns = new Map<string, DayColumn>();
  for (const slot of slots) {
    const key = dayKey(slot.start);
    if (!columns.has(key)) columns.set(key, { key, date: slot.start, slots: [] });
    columns.get(key)!.slots.push(slot);
  }
  return Array.from(columns.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const socket = useSocket();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookingKey, setBookingKey] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getDoctor(id)
      .then((res) => {
        setDoctor(res.doctor);
        setSlots(buildSlots(res.availability, res.bookedSlots));
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
  const days = groupByDay(slots);

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
      {days.length === 0 ? (
        <EmptyState icon="🗓️" text="Bu doktor için yaklaşan müsaitlik bulunmuyor." />
      ) : (
        <div className="week-calendar">
          {days.map((column) => {
            const { weekday, dayMonth } = formatDayHeader(column.date);
            return (
              <div key={column.key} className="week-day">
                <div className="week-day-header">
                  <strong>{weekday}</strong>
                  <span>{dayMonth}</span>
                </div>
                <div className="week-day-slots">
                  {column.slots.map((slot) => {
                    const key = slot.start.getTime();
                    return (
                      <div key={key} className={slot.booked ? 'slot-item slot-booked' : 'slot-item'}>
                        <strong>{formatTime(slot.start)}</strong>
                        {slot.booked ? (
                          <span className="slot-status">Dolu</span>
                        ) : canBook ? (
                          <button
                            className="secondary-button"
                            disabled={bookingKey === key}
                            onClick={() => handleBook(slot)}
                          >
                            {bookingKey === key ? 'Alınıyor…' : 'Randevu Al'}
                          </button>
                        ) : (
                          <span className="slot-status slot-status-free">Müsait</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
