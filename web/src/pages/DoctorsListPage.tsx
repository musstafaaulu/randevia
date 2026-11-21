import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDoctors } from '../api/doctors';
import type { Doctor } from '../types/api';
import { Spinner } from '../components/Spinner';

export function DoctorsListPage() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDoctors()
      .then((res) => setDoctors(res.doctors))
      .catch(() => setError('Doktorlar yüklenemedi.'));
  }, []);

  if (error) return <div className="page-error">{error}</div>;
  if (!doctors) return <Spinner label="Doktorlar yükleniyor…" />;

  return (
    <div className="page">
      <h1>Doktorlar</h1>
      {doctors.length === 0 ? (
        <p>Henüz kayıtlı doktor yok.</p>
      ) : (
        <div className="card-grid">
          {doctors.map((doctor) => (
            <Link key={doctor._id} to={`/doktorlar/${doctor._id}`} className="doctor-card">
              <div className="doctor-avatar" aria-hidden="true">
                {doctor.specialty.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2>{doctor.specialty}</h2>
                {doctor.bio && <p className="doctor-bio">{doctor.bio}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
