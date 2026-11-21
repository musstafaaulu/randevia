import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { resendVerificationEmail } from '../api/auth';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import type { User } from '../types/api';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/auth', () => ({
  resendVerificationEmail: vi.fn(),
}));

function mockUser(overrides: Partial<User> = {}): User {
  return {
    _id: '1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'patient',
    emailVerified: false,
    ...overrides,
  };
}

describe('EmailVerificationBanner', () => {
  it('renders nothing when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { container } = render(<EmailVerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing once the e-mail is verified', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser({ emailVerified: true }),
    } as ReturnType<typeof useAuth>);
    const { container } = render(<EmailVerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('resends the verification e-mail on click', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser() } as ReturnType<typeof useAuth>);
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EmailVerificationBanner />);
    await user.click(screen.getByRole('button', { name: /yeniden gönder/i }));

    await waitFor(() =>
      expect(screen.getByText('Doğrulama e-postası yeniden gönderildi.')).toBeInTheDocument(),
    );
  });
});
