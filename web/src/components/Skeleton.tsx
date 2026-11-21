export function DoctorCardSkeleton() {
  return (
    <div className="doctor-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-avatar" />
      <div className="skeleton-lines">
        <div className="skeleton skeleton-line skeleton-line-title" />
        <div className="skeleton skeleton-line skeleton-line-tag" />
        <div className="skeleton skeleton-line skeleton-line-body" />
      </div>
    </div>
  );
}

export function DoctorListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }, (_, i) => (
        <DoctorCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="appointment-item skeleton-card" aria-hidden="true">
      <div className="skeleton-lines" style={{ flex: 1 }}>
        <div className="skeleton skeleton-line skeleton-line-title" />
        <div className="skeleton skeleton-line skeleton-line-tag" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="appointment-list">
      {Array.from({ length: count }, (_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}
