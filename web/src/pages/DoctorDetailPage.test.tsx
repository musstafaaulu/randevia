import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppointment } from '../api/appointments';
import { getDoctor } from '../api/doctors';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../socket/SocketContext';
import { DoctorDetailPage } from './DoctorDetailPage';
import type { Availability, Doctor, User } from '../types/api';

vi.mock('../api/doctors', () => ({
  getDoctor: vi.fn(),
}));
vi.mock('../api/appointments', () => ({
  createAppointment: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../socket/SocketContext', () => ({
  useSocket: vi.fn(),
}));

const DOCTOR: Doctor = {
  _id: 'doc1',
  userId: 'user1',
  name: 'Dr. Test',
  specialty: 'Kardiyoloji',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Local-time fixtures: the grid classifies cells using the browser's local
// time (Date#getHours/getDay), same as the component, so tests don't need
// to care which timezone the machine running them is in.
function nextWeekday(daysAhead: number): Date {
  let date = new Date();
  date.setHours(0, 0, 0, 0);
  let remaining = daysAhead;
  while (remaining > 0) {
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  return date;
}

function atLocalTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function fullDayAvailability(date: Date): Availability[] {
  return [
    {
      _id: 'a1',
      doctorId: DOCTOR._id,
      startTime: atLocalTime(date, 9, 0).toISOString(),
      endTime: atLocalTime(date, 12, 0).toISOString(),
    },
    {
      _id: 'a2',
      doctorId: DOCTOR._id,
      startTime: atLocalTime(date, 13, 0).toISOString(),
      endTime: atLocalTime(date, 17, 0).toISOString(),
    },
  ];
}

function patientUser(): User {
  return { _id: 'u1', name: 'Hasta', email: 'hasta@example.com', role: 'patient', emailVerified: true };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/doktorlar/doc1']}>
      <Routes>
        <Route path="/doktorlar/:id" element={<DoctorDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: patientUser(),
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
  vi.mocked(useSocket).mockReturnValue(null);
});

describe('DoctorDetailPage weekly calendar', () => {
  it('shows the empty state when the doctor has no upcoming availability', async () => {
    vi.mocked(getDoctor).mockResolvedValue({ doctor: DOCTOR, availability: [], bookedSlots: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Bu doktor için yaklaşan müsaitlik bulunmuyor.')).toBeInTheDocument(),
    );
  });

  it('renders a bookable button for a free slot and lets the patient book it', async () => {
    const day = nextWeekday(1);
    vi.mocked(getDoctor).mockResolvedValue({
      doctor: DOCTOR,
      availability: fullDayAvailability(day),
      bookedSlots: [],
    });
    vi.mocked(createAppointment).mockResolvedValue({
      appointment: {
        _id: 'appt1',
        patientId: 'u1',
        doctorId: 'doc1',
        date: atLocalTime(day, 9, 0).toISOString(),
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const user = userEvent.setup();
    renderPage();

    const slotLabel = `${atLocalTime(day, 9, 0).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    })} için randevu al`;
    const slotButton = await screen.findByLabelText(slotLabel);
    await user.click(slotButton);

    await waitFor(() => expect(createAppointment).toHaveBeenCalled());
    expect(screen.getByText('Randevu talebiniz alındı. Doktorun onayını bekliyor.')).toBeInTheDocument();
  });

  it('shows the legend explaining closed / booked / free / unscheduled cells', async () => {
    const day = nextWeekday(1);
    vi.mocked(getDoctor).mockResolvedValue({
      doctor: DOCTOR,
      availability: fullDayAvailability(day),
      bookedSlots: [],
    });
    renderPage();

    await screen.findByText('Önceki Hafta', { exact: false });
    expect(screen.getByText('Müsait')).toBeInTheDocument();
    expect(screen.getByText('Dolu')).toBeInTheDocument();
    expect(screen.getByText('Planlanmamış')).toBeInTheDocument();
    expect(screen.getByText(/Kapalı \(hafta sonu/)).toBeInTheDocument();
  });

  it('disables going to the previous week on the first page', async () => {
    const day = nextWeekday(1);
    vi.mocked(getDoctor).mockResolvedValue({
      doctor: DOCTOR,
      availability: fullDayAvailability(day),
      bookedSlots: [],
    });
    renderPage();

    const prevButton = await screen.findByText('‹ Önceki Hafta');
    expect(prevButton).toBeDisabled();
  });

  it('lets a patient navigate to the next week within the 14-day window', async () => {
    const day = nextWeekday(1);
    vi.mocked(getDoctor).mockResolvedValue({
      doctor: DOCTOR,
      availability: fullDayAvailability(day),
      bookedSlots: [],
    });
    const user = userEvent.setup();
    renderPage();

    const nextButton = await screen.findByText('Sonraki Hafta ›');
    expect(nextButton).not.toBeDisabled();
    await user.click(nextButton);
    const prevButton = screen.getByText('‹ Önceki Hafta');
    expect(prevButton).not.toBeDisabled();
  });
});
