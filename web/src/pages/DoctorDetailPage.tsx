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

function formatSlot(date: Date): { day: string; time: string } {
  return {
    day: date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  };
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
      {slots.length === 0 ? (
        <EmptyState icon="🗓️" text="Bu doktor için yaklaşan müsaitlik bulunmuyor." />
      ) : (
        <ul className="slot-list">
          {slots.map((slot) => {
            const { day, time } = formatSlot(slot.start);
            const key = slot.start.getTime();
            return (
              <li key={key} className={slot.booked ? 'slot-item slot-booked' : 'slot-item'}>
                <div>
                  <strong>{time}</strong>
                  <span className="slot-day">{day}</span>
                </div>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
