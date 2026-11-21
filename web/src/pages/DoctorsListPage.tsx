import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDoctors } from '../api/doctors';
import type { Doctor } from '../types/api';
import { DoctorListSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { avatarColor } from '../utils/avatarColor';

function normalize(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

export function DoctorsListPage() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    listDoctors()
      .then((res) => setDoctors(res.doctors))
      .catch(() => setError('Doktorlar yüklenemedi.'));
  }, []);

  const specialties = useMemo(() => {
    if (!doctors) return [];
    return Array.from(new Set(doctors.map((d) => d.specialty))).sort((a, b) =>
      a.localeCompare(b, 'tr'),
    );
  }, [doctors]);

  const filtered = useMemo(() => {
    if (!doctors) return [];
    const query = normalize(search.trim());
    return doctors.filter((doctor) => {
      if (specialty && doctor.specialty !== specialty) return false;
      if (!query) return true;
      return normalize(doctor.name).includes(query) || normalize(doctor.specialty).includes(query);
    });
  }, [doctors, search, specialty]);

  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <h1>Doktorlar</h1>

      {doctors && doctors.length > 0 && (
        <div className="doctor-filters">
          <input
            type="search"
            placeholder="İsim veya uzmanlık alanına göre ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Doktor ara"
            className="doctor-search"
          />
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            aria-label="Uzmanlık alanına göre filtrele"
          >
            <option value="">Tüm uzmanlık alanları</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {!doctors ? (
        <DoctorListSkeleton />
      ) : doctors.length === 0 ? (
        <EmptyState icon="🩺" text="Henüz kayıtlı doktor yok." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔎" text="Aramanızla eşleşen doktor bulunamadı." />
      ) : (
        <div className="card-grid">
          {filtered.map((doctor) => (
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
