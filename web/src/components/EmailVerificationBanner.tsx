import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { resendVerificationEmail } from '../api/auth';
import { ApiError } from '../api/client';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setState('sending');
    setError(null);
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gönderilemedi');
      setState('error');
    }
  }

  return (
    <div className="verification-banner" role="status">
      {state === 'sent' ? (
        <span>Doğrulama e-postası yeniden gönderildi.</span>
      ) : (
        <>
          <span>E-posta adresiniz henüz doğrulanmadı.</span>
          <button
            className="verification-banner-button"
            onClick={handleResend}
            disabled={state === 'sending'}
          >
            {state === 'sending' ? 'Gönderiliyor…' : 'Doğrulama e-postasını yeniden gönder'}
          </button>
          {state === 'error' && error && <span className="verification-banner-error">{error}</span>}
        </>
      )}
    </div>
  );
}
