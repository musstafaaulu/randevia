import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { verifyEmail } from '../api/auth';
import { VerifyEmailPage } from './VerifyEmailPage';

vi.mock('../api/auth', () => ({
  verifyEmail: vi.fn(),
}));

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  it('verifies the token from the URL and shows success', async () => {
    vi.mocked(verifyEmail).mockResolvedValue(undefined);
    renderPage('/verify-email?token=abc123');

    await waitFor(() => expect(screen.getByText(/e-posta adresiniz doğrulandı/i)).toBeInTheDocument());
    expect(verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('shows the server error message when the token is rejected', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(new ApiError(400, 'Doğrulama bağlantısı geçersiz'));
    renderPage('/verify-email?token=bad');

    await waitFor(() => expect(screen.getByText('Doğrulama bağlantısı geçersiz')).toBeInTheDocument());
  });

  it('shows an error state when there is no token in the URL', () => {
    renderPage('/verify-email');

    expect(screen.getByText('Bu doğrulama bağlantısı geçersiz.')).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
