import { useCallback, useEffect, useState } from 'react';
import { cancelAppointment, confirmAppointment, listMyAppointments } from '../api/appointments';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/Spinner';
import { useSocket } from '../socket/SocketContext';
import type { Appointment, AppointmentStatus } from '../types/api';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Onay bekliyor',
  confirmed: 'Onaylandı',
  cancelled: 'İptal edildi',
  completed: 'Tamamlandı',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' });
}

export function MyAppointmentsPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listMyAppointments()
      .then((res) => setAppointments(res.appointments))
      .catch(() => setError('Randevular yüklenemedi.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Any appointment-related notification that reaches this user means their
  // list may have changed (new request, confirmation, cancellation).
  useEffect(() => {
    if (!socket) return;
    socket.on('notification', load);
    return () => {
      socket.off('notification', load);
    };
  }, [socket, load]);

  async function handleConfirm(appointment: Appointment) {
    setBusyId(appointment._id);
    try {
      await confirmAppointment(appointment._id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(appointment: Appointment) {
    setBusyId(appointment._id);
    try {
      await cancelAppointment(appointment._id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  }

  if (!appointments) return <Spinner label="Randevular yükleniyor…" />;

  return (
    <div className="page">
      <h1>Randevularım</h1>
      {error && <div className="form-error">{error}</div>}

      {appointments.length === 0 ? (
        <p>Henüz randevunuz yok.</p>
      ) : (
        <ul className="appointment-list">
          {appointments.map((appointment) => (
            <li key={appointment._id} className="appointment-item">
              <div>
                <strong>{formatDate(appointment.date)}</strong>
                <span className={`status-badge status-${appointment.status}`}>
                  {STATUS_LABELS[appointment.status]}
                </span>
              </div>
              <div className="appointment-actions">
                {user?.role === 'doctor' && appointment.status === 'pending' && (
                  <button
                    className="primary-button"
                    disabled={busyId === appointment._id}
                    onClick={() => handleConfirm(appointment)}
                  >
                    Onayla
                  </button>
                )}
                {user?.role === 'patient' &&
                  (appointment.status === 'pending' || appointment.status === 'confirmed') && (
                    <button
                      className="danger-button"
                      disabled={busyId === appointment._id}
                      onClick={() => handleCancel(appointment)}
                    >
                      İptal Et
                    </button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
