import type { AppointmentStats, AppointmentStatus, UserStats } from '../types/api';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Onay bekliyor',
  confirmed: 'Onaylandı',
  cancelled: 'İptal edildi',
  completed: 'Tamamlandı',
};

const STATUS_ORDER: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function StatsPanel({
  userStats,
  appointmentStats,
}: {
  userStats: UserStats;
  appointmentStats: AppointmentStats;
}) {
  const maxDaily = Math.max(1, ...appointmentStats.dailyCounts.map((d) => d.count));
  const totalByStatus =
    Object.values(appointmentStats.byStatus).reduce((sum, count) => sum + count, 0) || 1;

  return (
    <section className="panel-section">
      <h2 className="section-title">Genel Bakış</h2>

      <div className="stat-cards">
        <StatCard label="Toplam Kullanıcı" value={userStats.total} />
        <StatCard label="Hasta" value={userStats.byRole.patient} />
        <StatCard label="Doktor" value={userStats.byRole.doctor} />
        <StatCard label="Toplam Randevu" value={appointmentStats.totalAppointments} />
      </div>

      <div className="stats-grid">
        <div className="chart-card">
          <h3>Son 14 Günde Randevu Sayısı</h3>
          <div className="bar-chart">
            {appointmentStats.dailyCounts.map((day) => (
              <div key={day.date} className="bar-chart-col" title={`${day.date}: ${day.count}`}>
                <div
                  className="bar-chart-bar"
                  style={{ height: `${Math.max(4, (day.count / maxDaily) * 100)}%` }}
                />
                <span className="bar-chart-label">
                  {new Date(day.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Duruma Göre Dağılım</h3>
          <ul className="status-distribution">
            {STATUS_ORDER.map((status) => {
              const count = appointmentStats.byStatus[status];
              const percent = Math.round((count / totalByStatus) * 100);
              return (
                <li key={status}>
                  <div className="status-distribution-row">
                    <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>
                    <span>{count}</span>
                  </div>
                  <div className="status-distribution-track">
                    <div
                      className={`status-distribution-fill status-distribution-${status}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
