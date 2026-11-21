import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgotPassword } from '../api/auth';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('../api/auth', () => ({
  forgotPassword: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(forgotPassword).mockResolvedValue(undefined);
});

describe('ForgotPasswordPage', () => {
  it('shows a confirmation after submitting a valid e-mail', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }));

    await waitFor(() =>
      expect(screen.getByText(/şifre sıfırlama bağlantısı gönderildi/i)).toBeInTheDocument(),
    );
    expect(forgotPassword).toHaveBeenCalledWith('ada@example.com');
  });

  it('shows a validation error and does not submit for an invalid e-mail', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-posta'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }));

    expect(screen.getByText('Geçerli bir e-posta adresi girin.')).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });
});
