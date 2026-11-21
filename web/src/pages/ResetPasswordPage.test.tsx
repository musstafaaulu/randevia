import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPassword } from '../api/auth';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../api/auth', () => ({
  resetPassword: vi.fn(),
}));

function renderPage(path = '/reset-password?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(resetPassword).mockResolvedValue(undefined);
});

describe('ResetPasswordPage', () => {
  it('submits the token from the URL with the new password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Yeni Şifre'), 'brand-new-password-123');
    await user.click(screen.getByRole('button', { name: 'Şifreyi Güncelle' }));

    await waitFor(() => expect(screen.getByText(/şifreniz sıfırlandı/i)).toBeInTheDocument());
    expect(resetPassword).toHaveBeenCalledWith('abc123', 'brand-new-password-123');
  });

  it('rejects a password shorter than 8 characters without submitting', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Yeni Şifre'), 'short');
    await user.click(screen.getByRole('button', { name: 'Şifreyi Güncelle' }));

    expect(screen.getByText('Şifre en az 8 karakter olmalı.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows an invalid-link state when there is no token in the URL', () => {
    renderPage('/reset-password');

    expect(screen.getByText('Geçersiz Bağlantı')).toBeInTheDocument();
  });
});
