import { useCallback, useEffect, useState } from 'react';
import { getUserStats, listUsers, updateUserRole } from '../api/auth';
import { getAppointmentStats } from '../api/appointments';
import { ApiError } from '../api/client';
import { Spinner } from '../components/Spinner';
import { StatsPanel } from '../components/StatsPanel';
import type { AppointmentStats, Role, User, UserStats } from '../types/api';

const ROLES: Role[] = ['patient', 'doctor', 'admin'];
const ROLE_LABELS: Record<Role, string> = { patient: 'Hasta', doctor: 'Doktor', admin: 'Admin' };

export function AdminPanelPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({});
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const load = useCallback(() => {
    listUsers({ role: roleFilter || undefined, limit: 100 })
      .then((res) => setUsers(res.users))
      .catch(() => setError('Kullanıcılar yüklenemedi.'));
  }, [roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([getUserStats(), getAppointmentStats()])
      .then(([u, a]) => {
        setUserStats(u);
        setAppointmentStats(a);
      })
      .catch(() => setStatsError('İstatistikler yüklenemedi.'));
  }, []);

  async function handleSave(user: User) {
    const nextRole = pendingRole[user._id] ?? user.role;
    if (nextRole === user.role) return;
    setBusyId(user._id);
    setError(null);
    try {
      await updateUserRole(user._id, nextRole);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rol güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <h1>Admin Paneli</h1>
      <p className="auth-subtitle">Kullanıcı rollerini yönetin. Doktor rolü yalnızca buradan atanabilir.</p>

      {error && <div className="form-error">{error}</div>}
      {statsError && <div className="form-error">{statsError}</div>}

      {userStats && appointmentStats && (
        <StatsPanel userStats={userStats} appointmentStats={appointmentStats} />
      )}

      <div className="filter-row">
        <label>
          Role göre filtrele
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
            <option value="">Tümü</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!users ? (
        <Spinner label="Kullanıcılar yükleniyor…" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={pendingRole[user._id] ?? user.role}
                      onChange={(e) =>
                        setPendingRole((prev) => ({ ...prev, [user._id]: e.target.value as Role }))
                      }
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="secondary-button"
                      disabled={
                        busyId === user._id || (pendingRole[user._id] ?? user.role) === user.role
                      }
                      onClick={() => handleSave(user)}
                    >
                      Kaydet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
