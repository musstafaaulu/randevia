import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDoctors } from '../api/doctors';
import type { Doctor } from '../types/api';
import { DoctorListSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { avatarColor } from '../utils/avatarColor';

export function DoctorsListPage() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDoctors()
      .then((res) => setDoctors(res.doctors))
      .catch(() => setError('Doktorlar yüklenemedi.'));
  }, []);

  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <h1>Doktorlar</h1>
      {!doctors ? (
        <DoctorListSkeleton />
      ) : doctors.length === 0 ? (
        <EmptyState icon="🩺" text="Henüz kayıtlı doktor yok." />
      ) : (
        <div className="card-grid">
          {doctors.map((doctor) => (
            <Link key={doctor._id} to={`/doktorlar/${doctor._id}`} className="doctor-card">
              <div
                className="doctor-avatar"
                style={{ background: avatarColor(doctor.name) }}
                aria-hidden="true"
              >
                {doctor.name.charAt(0).toUpperCase()}
              </div>
              <div className="doctor-card-body">
                <h2>{doctor.name}</h2>
                <span className="specialty-tag">{doctor.specialty}</span>
                {doctor.bio && <p className="doctor-bio">{doctor.bio}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
