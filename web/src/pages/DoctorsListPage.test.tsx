import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDoctors } from '../api/doctors';
import { DoctorsListPage } from './DoctorsListPage';
import type { Doctor } from '../types/api';

vi.mock('../api/doctors', () => ({
  listDoctors: vi.fn(),
}));

function makeDoctor(overrides: Partial<Doctor>): Doctor {
  return {
    _id: overrides._id ?? Math.random().toString(36),
    userId: 'user-1',
    name: 'Dr. Test',
    specialty: 'Genel',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const doctors: Doctor[] = [
  makeDoctor({ _id: '1', name: 'Dr. Elif Arslan', specialty: 'Dahiliye' }),
  makeDoctor({ _id: '2', name: 'Dr. Mert Kaya', specialty: 'Ortopedi ve Travmatoloji' }),
  makeDoctor({ _id: '3', name: 'Dr. Ayşe Demir', specialty: 'Nöroloji' }),
];

function renderPage() {
  return render(
    <MemoryRouter>
      <DoctorsListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(listDoctors).mockResolvedValue({ doctors });
});

describe('DoctorsListPage', () => {
  it('lists every doctor once loaded', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Dr. Elif Arslan')).toBeInTheDocument());
    expect(screen.getByText('Dr. Mert Kaya')).toBeInTheDocument();
    expect(screen.getByText('Dr. Ayşe Demir')).toBeInTheDocument();
  });

  it('filters by name as the user types', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Dr. Elif Arslan')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('İsim veya uzmanlık alanına göre ara…'), 'mert');

    expect(screen.getByText('Dr. Mert Kaya')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Elif Arslan')).not.toBeInTheDocument();
    expect(screen.queryByText('Dr. Ayşe Demir')).not.toBeInTheDocument();
  });

  it('filters by the selected specialty', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Dr. Elif Arslan')).toBeInTheDocument());

    await user.selectOptions(
      screen.getByLabelText('Uzmanlık alanına göre filtrele'),
      'Nöroloji',
    );

    expect(screen.getByText('Dr. Ayşe Demir')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Elif Arslan')).not.toBeInTheDocument();
  });

  it('shows a dedicated empty state when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Dr. Elif Arslan')).toBeInTheDocument());

    await user.type(
      screen.getByPlaceholderText('İsim veya uzmanlık alanına göre ara…'),
      'bulunmayan doktor',
    );

    expect(screen.getByText('Aramanızla eşleşen doktor bulunamadı.')).toBeInTheDocument();
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(listDoctors).mockRejectedValueOnce(new Error('network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Doktorlar yüklenemedi.')).toBeInTheDocument());
  });
});
