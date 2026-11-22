import { useCallback, useEffect, useState } from 'react';
import {
  cancelAppointment,
  confirmAppointment,
  downloadAppointmentIcs,
  listMyAppointments,
} from '../api/appointments';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { useSocket } from '../socket/SocketContext';
import type { Appointment, AppointmentStatus } from '../types/api';

type PendingAction = { type: 'confirm' | 'cancel'; appointment: Appointment };

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  async function handleDownloadIcs(appointment: Appointment) {
    try {
      await downloadAppointmentIcs(appointment._id);
    } catch {
      setError('Takvim dosyası indirilemedi.');
    }
  }

  async function runPendingAction() {
    if (!pendingAction) return;
    const { type, appointment } = pendingAction;
    setBusyId(appointment._id);
    try {
      if (type === 'confirm') {
        await confirmAppointment(appointment._id);
      } else {
        await cancelAppointment(appointment._id);
      }
      load();
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem başarısız oldu.');
      setPendingAction(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <h1>Randevularım</h1>
      {error && <div className="form-error">{error}</div>}

      {!appointments ? (
        <ListSkeleton />
      ) : appointments.length === 0 ? (
        <EmptyState icon="📅" text="Henüz randevunuz yok." />
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
                {appointment.status === 'confirmed' && (
                  <button
                    className="secondary-button"
                    onClick={() => handleDownloadIcs(appointment)}
                  >
                    Takvime Ekle
                  </button>
                )}
                {user?.role === 'doctor' && appointment.status === 'pending' && (
                  <button
                    className="primary-button"
                    disabled={busyId === appointment._id}
                    onClick={() => setPendingAction({ type: 'confirm', appointment })}
                  >
                    Onayla
                  </button>
                )}
                {user?.role === 'patient' &&
                  (appointment.status === 'pending' || appointment.status === 'confirmed') && (
                    <button
                      className="danger-button"
                      disabled={busyId === appointment._id}
                      onClick={() => setPendingAction({ type: 'cancel', appointment })}
                    >
                      İptal Et
                    </button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.type === 'confirm' ? 'Randevuyu onayla' : 'Randevuyu iptal et'}
        message={
          pendingAction
            ? pendingAction.type === 'confirm'
              ? `${formatDate(pendingAction.appointment.date)} tarihli randevuyu onaylamak istediğinize emin misiniz?`
              : `${formatDate(pendingAction.appointment.date)} tarihli randevuyu iptal etmek istediğinize emin misiniz?`
            : ''
        }
        confirmLabel={pendingAction?.type === 'confirm' ? 'Onayla' : 'Evet, iptal et'}
        cancelLabel="Vazgeç"
        danger={pendingAction?.type === 'cancel'}
        busy={busyId !== null}
        onConfirm={runPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
