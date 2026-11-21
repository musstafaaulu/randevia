import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { confirmAppointment, listMyAppointments } from '../api/appointments';
import { ApiError } from '../api/client';
import {
  addMyAvailability,
  deleteMyAvailability,
  getDoctor,
  listDoctors,
  upsertMyDoctorProfile,
} from '../api/doctors';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { FieldError } from '../components/FieldError';
import { Spinner } from '../components/Spinner';
import { useSocket } from '../socket/SocketContext';
import type { Appointment, Availability, Doctor } from '../types/api';

function formatRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const startTime = startDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime} - ${endTime}`;
}

export function DoctorPanelPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [myDoctor, setMyDoctor] = useState<Doctor | null | undefined>(undefined);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [pending, setPending] = useState<Appointment[]>([]);
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Appointment | null>(null);
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Availability | null>(null);
  const [deletingAvailability, setDeletingAvailability] = useState(false);

  // There is no "my profile" endpoint; the doctor list already carries
  // userId, and /auth/me's id is the same value a doctor's own profile was
  // created with, so that is how the current user's profile is found.
  const refresh = useCallback(async () => {
    const { doctors } = await listDoctors();
    const own = doctors.find((d) => d.userId === user?._id) ?? null;
    setMyDoctor(own);
    if (own) {
      setSpecialty(own.specialty);
      setBio(own.bio ?? '');
      const detail = await getDoctor(own._id);
      setAvailability(detail.availability);
    }
  }, [user]);

  useEffect(() => {
    void refresh().catch(() => setError('Profil bilgileri yüklenemedi.'));
  }, [refresh]);

  const loadPending = useCallback(() => {
    listMyAppointments()
      .then((res) => setPending(res.appointments.filter((a) => a.status === 'pending')))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!socket) return;
    socket.on('notification', loadPending);
    return () => {
      socket.off('notification', loadPending);
    };
  }, [socket, loadPending]);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    setMessage(null);
    try {
      await upsertMyDoctorProfile({ name: user.name, specialty, bio: bio || undefined });
      setMessage('Profil kaydedildi.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Profil kaydedilemedi.');
    }
  }

  const endTimeError =
    endTimeTouched && startTime && endTime && endTime <= startTime
      ? 'Bitiş saati başlangıçtan sonra olmalı.'
      : undefined;

  async function handleAvailabilitySubmit(event: FormEvent) {
    event.preventDefault();
    setEndTimeTouched(true);
    if (startTime && endTime && endTime <= startTime) return;
    setError(null);
    setMessage(null);
    try {
      await addMyAvailability({
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setMessage('Müsaitlik eklendi.');
      setStartTime('');
      setEndTime('');
      setEndTimeTouched(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Müsaitlik eklenemedi.');
    }
  }

  async function handleDeleteAvailability() {
    if (!deleteTarget) return;
    setDeletingAvailability(true);
    try {
      await deleteMyAvailability(deleteTarget._id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Müsaitlik silinemedi.');
      setDeleteTarget(null);
    } finally {
      setDeletingAvailability(false);
    }
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setBusyId(confirmTarget._id);
    try {
      await confirmAppointment(confirmTarget._id);
      loadPending();
      setConfirmTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Onaylanamadı.');
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  if (myDoctor === undefined) return <Spinner label="Panel yükleniyor…" />;

  return (
    <div className="page">
      <h1>Doktor Paneli</h1>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-notice">{message}</div>}

      <section className="panel-section">
        <h2 className="section-title">Bekleyen Randevu Talepleri</h2>
        {pending.length === 0 ? (
          <EmptyState icon="✅" text="Bekleyen randevu talebi yok." />
        ) : (
          <ul className="appointment-list">
            {pending.map((appointment) => (
              <li key={appointment._id} className="appointment-item">
                <strong>
                  {new Date(appointment.date).toLocaleString('tr-TR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </strong>
                <button
                  className="primary-button"
                  disabled={busyId === appointment._id}
                  onClick={() => setConfirmTarget(appointment)}
                >
                  Onayla
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Randevuyu onayla"
        message={
          confirmTarget
            ? `${new Date(confirmTarget.date).toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' })} tarihli randevuyu onaylamak istediğinize emin misiniz?`
            : ''
        }
        busy={busyId !== null}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />

      <section className="panel-section">
        <h2 className="section-title">Doktor Profili</h2>
        <form className="inline-form" onSubmit={handleProfileSubmit}>
          <label>
            Uzmanlık Alanı
            <input
              type="text"
              required
              minLength={2}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </label>
          <label>
            Biyografi
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} />
          </label>
          <button className="primary-button" type="submit">
            {myDoctor ? 'Profili Güncelle' : 'Profili Oluştur'}
          </button>
        </form>
      </section>

      <section className="panel-section">
        <h2 className="section-title">Müsaitlik Ekle</h2>
        {!myDoctor ? (
          <p>Müsaitlik ekleyebilmek için önce profilinizi oluşturun.</p>
        ) : (
          <>
            <form className="inline-form" onSubmit={handleAvailabilitySubmit}>
              <label>
                Başlangıç
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label>
                Bitiş
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  onBlur={() => setEndTimeTouched(true)}
                />
                <FieldError message={endTimeError} />
              </label>
              <button className="primary-button" type="submit">
                Ekle
              </button>
            </form>

            {availability.length > 0 && (
              <ul className="availability-list">
                {availability.map((slot) => (
                  <li key={slot._id} className="availability-item">
                    <span>{formatRange(slot.startTime, slot.endTime)}</span>
                    <button
                      className="link-button danger-link"
                      onClick={() => setDeleteTarget(slot)}
                      aria-label="Müsaitliği sil"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Müsaitliği sil"
        message={
          deleteTarget
            ? `${formatRange(deleteTarget.startTime, deleteTarget.endTime)} aralığındaki müsaitliği silmek istediğinize emin misiniz?`
            : ''
        }
        confirmLabel="Evet, sil"
        danger
        busy={deletingAvailability}
        onConfirm={handleDeleteAvailability}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
